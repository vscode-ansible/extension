import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';

export type NodeKind = 'role' | 'playbook' | 'host' | 'group' | 'task' | 'var' | 'result' | 'fact' | 'play';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  subtitle?: string;
  status?: string;
  data?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GraphData {
  kind: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/* ------------------------------------------------------------------ */
/* Roles                                                              */
/* ------------------------------------------------------------------ */

function listDirNames(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function listPlaybooks(root: string): string[] {
  try {
    return fs
      .readdirSync(root)
      .filter((f) => /\.ya?ml$/i.test(f))
      .sort();
  } catch {
    return [];
  }
}

function readYamlFile(filePath: string): Record<string, unknown> {
  try {
    return (parseYaml(fs.readFileSync(filePath, 'utf8')) ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asDepList(deps: unknown): Array<string | { role?: string }> {
  if (!Array.isArray(deps)) return [];
  return deps.map((d) => (typeof d === 'string' ? d : { role: (d as { role?: string }).role }));
}

/** Roles and playbooks graph: dependencies from roles/<name>/meta/main.yml and import_playbook. */
export function shapeRoles(projectRoot: string): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const roleNames = listDirNames(path.join(projectRoot, 'roles'));
  const playbooks = listPlaybooks(projectRoot);

  const addNode = (id: string, kind: NodeKind, label: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, kind, label });
  };
  const addEdge = (source: string, target: string, label?: string) => {
    edges.push({ id: `${source}->${target}`, source, target, label });
  };

  for (const role of roleNames) {
    const roleId = `role:${role}`;
    addNode(roleId, 'role', role);
    const metaPath = path.join(projectRoot, 'roles', role, 'meta', 'main.yml');
    const meta = readYamlFile(metaPath);
    for (const dep of asDepList(meta.dependencies)) {
      const depName = typeof dep === 'string' ? dep : dep.role;
      if (!depName) continue;
      const depId = `role:${depName}`;
      addNode(depId, 'role', depName);
      addEdge(roleId, depId);
    }
  }

  for (const playbook of playbooks) {
    if (playbook === 'requirements.yml') continue;
    const pbId = `playbook:${playbook}`;
    addNode(pbId, 'playbook', playbook);
    const doc = readYamlFile(path.join(projectRoot, playbook));
    const entries = Array.isArray(doc) ? (doc as Record<string, unknown>[]) : [doc];
    for (const entry of entries) {
      const imp = entry.import_playbook;
      if (typeof imp === 'string') {
        const target = `playbook:${imp}`;
        addNode(target, 'playbook', imp);
        addEdge(pbId, target, 'import');
      }
      const roles = entry.roles;
      if (Array.isArray(roles)) {
        for (const ref of roles) {
          const roleName = typeof ref === 'string' ? ref : (ref as { role?: string }).role;
          if (!roleName) continue;
          const roleId = `role:${roleName}`;
          addNode(roleId, 'role', roleName);
          addEdge(pbId, roleId, 'role');
        }
      }
    }
  }

  return { kind: 'roles', nodes, edges };
}

/* ------------------------------------------------------------------ */
/* Runtime                                                            */
/* ------------------------------------------------------------------ */

const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*m/g;

const TASK_STATUS_ORDER = ['unreachable', 'failed', 'changed', 'ok'] as const;

/** Parses ansible-playbook output into a play → task → result graph. */
export function shapeRuntime(text: string): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const edgeIds = new Set<string>();

  let currentPlay: string | null = null;
  let currentTask: string | null = null;

  const ensureNode = (node: GraphNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  };
  const addEdge = (edge: GraphEdge) => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(ANSI_ESCAPE_RE, '').trim();
    if (!line) continue;

    const taskHeader = line.match(/^TASK \[(.*?)\]/);
    if (taskHeader) {
      currentTask = taskHeader[1] ?? null;
      if (currentPlay) {
        const taskId = `task:${currentPlay}:${currentTask}`;
        ensureNode({ id: taskId, kind: 'task', label: currentTask });
        addEdge({ id: `${currentPlay}->${taskId}`, source: currentPlay, target: taskId });
      }
      continue;
    }

    const playTitle = line.match(/^PLAY \[(.*?)\]/);
    if (playTitle) {
      currentPlay = `play:${playTitle[1] ?? ''}`;
      ensureNode({ id: currentPlay, kind: 'play', label: playTitle[1] ?? '' });
      continue;
    }

    if (line.startsWith('fatal:')) {
      const host = line.match(/\[([A-Za-z0-9._-]+)\]/)?.[1] ?? '?';
      const status = line.includes('UNREACHABLE') ? 'unreachable' : 'failed';
      addResult(nodes, edges, currentPlay, currentTask, host, status, ensureNode, addEdge);
      continue;
    }

    for (const status of TASK_STATUS_ORDER) {
      if (line.startsWith(`${status}:`) || line.startsWith(`${status}: [`)) {
        const host = line.match(/\[([A-Za-z0-9._-]+)\]/)?.[1] ?? '?';
        addResult(nodes, edges, currentPlay, currentTask, host, status, ensureNode, addEdge);
        break;
      }
    }
  }

  return { kind: 'runtime', nodes, edges };
}

function addResult(
  nodes: GraphNode[],
  edges: GraphEdge[],
  playId: string | null,
  task: string | null,
  host: string,
  status: string,
  ensureNode: (n: GraphNode) => void,
  addEdge: (e: GraphEdge) => void,
): void {
  const play = playId ?? 'play:default';
  ensureNode({ id: play, kind: 'play', label: play.replace(/^play:/, '') });
  const taskId = `task:${play}:${task ?? '(task)'}`;
  ensureNode({ id: taskId, kind: 'task', label: task ?? '(task)' });
  const resultId = `result:${play}:${task ?? ''}:${edges.length}`;
  ensureNode({ id: resultId, kind: 'result', label: status, subtitle: host, status });
  addEdge({ id: `${taskId}->${resultId}`, source: taskId, target: resultId, label: host });
}

/* ------------------------------------------------------------------ */
/* Inventory                                                          */
/* ------------------------------------------------------------------ */

export interface InventoryListJson {
  _meta?: { hostvars?: Record<string, Record<string, unknown>> };
  [group: string]: { children?: string[]; hosts?: string[] } | unknown;
}

/** Group → hosts graph from `ansible-inventory --list`. */
export function shapeInventory(json: InventoryListJson): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const addNode = (node: GraphNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  };
  const addEdge = (e: GraphEdge) => edges.push(e);

  const groups = Object.keys(json).filter((k) => k !== '_meta');

  for (const group of groups) {
    addNode({ id: `group:${group}`, kind: 'group', label: group });
    const entry = json[group] as { children?: string[]; hosts?: string[] };
    for (const child of entry?.children ?? []) {
      addEdge({ id: `${group}->${child}`, source: `group:${group}`, target: `group:${child}` });
    }
    for (const host of entry?.hosts ?? []) {
      const hostId = `host:${host}`;
      addNode({ id: hostId, kind: 'host', label: host });
      addEdge({ id: `${group}->${host}`, source: `group:${group}`, target: hostId });
    }
  }

  return { kind: 'inventory', nodes, edges };
}
