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

/**
 * Extracts the module name (and a human label) from a single task mapping.
 * A task like `{ name, apt: { name: nginx } }` yields module `apt`.
 */
export function taskModule(task: Record<string, unknown>): string | null {
  for (const key of Object.keys(task)) {
    if (key === 'name' || key.startsWith('ansible.')) continue;
    if (['when', 'notify', 'become', 'tags', 'register', 'loop', 'with_items', 'vars', 'block', 'import_tasks', 'include_tasks', 'import_role', 'include_role'].includes(key)) continue;
    return key;
  }
  return null;
}

/** Read a YAML mapping file as a list of tasks (or empty). */
function readTaskList(filePath: string): Array<Record<string, unknown>> {
  try {
    const doc = parseYaml(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(doc)) return doc as Array<Record<string, unknown>>;
    return [];
  } catch {
    return [];
  }
}

/**
 * Drill-down graph of a single playbook: playbook → play → role → task.
 * Roles resolve to their tasks/handlers so the flow is visible end to end.
 */
export function shapePlaybookDetail(projectRoot: string, playbookName: string): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const edgeIds = new Set<string>();

  const addNode = (n: GraphNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  };
  const addEdge = (e: GraphEdge) => {
    if (edgeIds.has(e.id)) return;
    edgeIds.add(e.id);
    edges.push(e);
  };

  const doc = readYamlFile(path.join(projectRoot, playbookName));
  const entries = Array.isArray(doc) ? (doc as Record<string, unknown>[]) : [doc];

  const pbFile = path.join(projectRoot, playbookName);
  if (entries.length === 0 || entries.every((e) => Object.keys(e).length === 0)) {
    return { kind: 'playbook', nodes: [{ id: `playbook:${playbookName}`, kind: 'playbook', label: playbookName, data: { file: pbFile } }], edges: [] };
  }

  addNode({ id: `playbook:${playbookName}`, kind: 'playbook', label: playbookName, data: { file: pbFile } });

  entries.forEach((entry, pi) => {
    const playName = typeof entry.name === 'string' ? entry.name : `play ${pi + 1}`;
    const hosts = typeof entry.hosts === 'string' ? entry.hosts : 'all';
    const playId = `play:${playbookName}:${pi}`;
    addNode({ id: playId, kind: 'play', label: playName, subtitle: hosts, data: { file: pbFile, line: 0 } });
    addEdge({ id: `playbook:${playbookName}->${playId}`, source: `playbook:${playbookName}`, target: playId, label: 'contains' });

    // Roles assigned to this play.
    const roles = Array.isArray(entry.roles) ? entry.roles as Array<string | { role?: string }> : [];
    roles.forEach((ref) => {
      const roleName = typeof ref === 'string' ? ref : ref.role;
      if (!roleName) return;
      appendRoleToPlay(projectRoot, playId, roleName, playbookName, nodes, edges, seen, edgeIds);
    });

    // Inline tasks (if the play has tasks directly).
    const tasks = Array.isArray(entry.tasks) ? entry.tasks as Array<Record<string, unknown>> : [];
    tasks.forEach((task, ti) => {
      const label = typeof task.name === 'string' ? task.name : `task ${ti + 1}`;
      const mod = taskModule(task);
      const taskId = `task:${playbookName}:${pi}:${ti}`;
      addNode({ id: taskId, kind: 'task', label, subtitle: mod ?? undefined, data: { file: pbFile } });
      addEdge({ id: `${playId}->${taskId}`, source: playId, target: taskId, label: mod ?? 'task' });
    });
  });

  return { kind: 'playbook', nodes, edges };
}

function appendRoleToPlay(
  projectRoot: string,
  playId: string,
  roleName: string,
  playbookName: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  seen: Set<string>,
  edgeIds: Set<string>,
): void {
  const addNode = (n: GraphNode) => { if (seen.has(n.id)) return; seen.add(n.id); nodes.push(n); };
  const addEdge = (e: GraphEdge) => { if (edgeIds.has(e.id)) return; edgeIds.add(e.id); edges.push(e); };

  const roleId = `role:${roleName}`;
  const roleFile = path.join(projectRoot, 'roles', roleName, 'tasks', 'main.yml');
  addNode({ id: roleId, kind: 'role', label: roleName, data: { file: roleFile } });
  addEdge({ id: `${playId}->${roleId}`, source: playId, target: roleId, label: 'uses' });

  const tasksPath = roleFile;
  const tasks = readTaskList(tasksPath);
  tasks.forEach((task, ti) => {
    const label = typeof task.name === 'string' ? task.name : `task ${ti + 1}`;
    const mod = taskModule(task);
    const taskId = `task:${roleName}:${ti}`;
    addNode({ id: taskId, kind: 'task', label, subtitle: mod ?? undefined, data: { file: tasksPath } });
    addEdge({ id: `${roleId}->${taskId}`, source: roleId, target: taskId, label: mod ?? 'task' });

    // Handlers notified by this task.
    const notify = task.notify;
    const notified = Array.isArray(notify) ? notify.map(String) : typeof notify === 'string' ? [notify] : [];
    for (const handlerName of notified) {
      const handlerId = `handler:${roleName}:${handlerName}`;
      addNode({ id: handlerId, kind: 'task', label: handlerName, subtitle: 'handler', data: { file: path.join(projectRoot, 'roles', roleName, 'handlers', 'main.yml') } });
      addEdge({ id: `${taskId}->${handlerId}`, source: taskId, target: handlerId, label: 'notifies' });
    }
  });

  // Any handlers not referenced by a notify are also listed.
  const handlersPath = path.join(projectRoot, 'roles', roleName, 'handlers', 'main.yml');
  const handlers = readTaskList(handlersPath);
  handlers.forEach((h, hi) => {
    const label = typeof h.name === 'string' ? h.name : `handler ${hi + 1}`;
    const id = `handler:${roleName}:${label}`;
    addNode({ id, kind: 'task', label, subtitle: 'handler', data: { file: handlersPath } });
    addEdge({ id: `${roleId}->${id}`, source: roleId, target: id, label: 'handles' });
  });
}

/** Roles and playbooks graph: dependencies from roles/<name>/meta/main.yml and import_playbook. */
export function shapeRoles(projectRoot: string): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const roleNames = listDirNames(path.join(projectRoot, 'roles'));
  const playbooks = listPlaybooks(projectRoot);

  const addNode = (id: string, kind: NodeKind, label: string, file?: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, kind, label, data: file ? { file } : undefined });
  };
  const addEdge = (source: string, target: string, label?: string) => {
    edges.push({ id: `${source}->${target}`, source, target, label });
  };

  for (const role of roleNames) {
    const roleId = `role:${role}`;
    addNode(roleId, 'role', role, path.join(projectRoot, 'roles', role, 'tasks', 'main.yml'));
    const metaPath = path.join(projectRoot, 'roles', role, 'meta', 'main.yml');
    const meta = readYamlFile(metaPath);
    for (const dep of asDepList(meta.dependencies)) {
      const depName = typeof dep === 'string' ? dep : dep.role;
      if (!depName) continue;
      const depId = `role:${depName}`;
      addNode(depId, 'role', depName, path.join(projectRoot, 'roles', depName, 'tasks', 'main.yml'));
      addEdge(roleId, depId, 'depends on');
    }
  }

  for (const playbook of playbooks) {
    if (playbook === 'requirements.yml') continue;
    const pbId = `playbook:${playbook}`;
    addNode(pbId, 'playbook', playbook, path.join(projectRoot, playbook));
    const doc = readYamlFile(path.join(projectRoot, playbook));
    const entries = Array.isArray(doc) ? (doc as Record<string, unknown>[]) : [doc];
    for (const entry of entries) {
      const imp = entry.import_playbook;
      if (typeof imp === 'string') {
        const target = `playbook:${imp}`;
        addNode(target, 'playbook', imp, path.join(projectRoot, imp));
        addEdge(pbId, target, 'imports');
      }
      const roles = entry.roles;
      if (Array.isArray(roles)) {
        for (const ref of roles) {
          const roleName = typeof ref === 'string' ? ref : (ref as { role?: string }).role;
          if (!roleName) continue;
          const roleId = `role:${roleName}`;
          addNode(roleId, 'role', roleName, path.join(projectRoot, 'roles', roleName, 'tasks', 'main.yml'));
          addEdge(pbId, roleId, 'uses');
        }
      }
    }
  }

  return { kind: 'roles', nodes, edges };
}

/* ------------------------------------------------------------------ */
/* Runtime                                                            */
/* ------------------------------------------------------------------ */

// Matches ANSI escape sequences (e.g. color codes) for stripping from output.
// eslint-disable-next-line no-control-regex
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
