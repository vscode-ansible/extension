import * as vscode from 'vscode';
import { shapePlaybookDetail, shapeRoles } from './pure';
import type { GraphData } from './pure';

/**
 * A drill-down graph navigator. Shows the project overview (all playbooks)
 * first; clicking a playbook drills into its play → role → task flow, and
 * clicking a role/task continues deeper. Breadcrumbs let you walk back up.
 */

type Level = { kind: 'overview' | 'playbook' | 'role'; key: string };

function renderGraphHtml(graph: GraphData, path: Level[]): string {
  const dataJson = JSON.stringify(graph).replace(/</g, '\\u003c');
  const pathJson = JSON.stringify(path).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; background: var(--vscode-editor-background); font-family: var(--vscode-font-family, -apple-system, Segoe UI, sans-serif); overflow: hidden; display: flex; flex-direction: column; height: 100vh; }
  #crumb { display: flex; align-items: center; gap: 2px; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px; flex-wrap: wrap; }
  #crumb .c { padding: 2px 8px; border-radius: 3px; cursor: pointer; color: var(--vscode-textLink-foreground); }
  #crumb .c:hover { background: var(--vscode-list-hoverBackground); }
  #crumb .c.active { color: var(--vscode-foreground); font-weight: 600; cursor: default; }
  #crumb .sep { color: var(--vscode-descriptionForeground); }
  #hint { padding: 4px 10px; font-size: 11px; color: var(--vscode-descriptionForeground); }
  #svg { flex: 1; }
  .node circle { stroke: var(--vscode-panel-border); stroke-width: 1.5; cursor: pointer; }
  .node text { fill: var(--vscode-foreground); font-size: 12px; pointer-events: none; }
  .node .sub { fill: var(--vscode-descriptionForeground); font-size: 10px; }
  .edge { stroke: var(--vscode-foreground); stroke-opacity: 0.35; fill: none; }
  .edge-lbl { font-size: 10px; fill: var(--vscode-descriptionForeground); }
  .legend { position: fixed; top: 46px; right: 12px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 6px 10px; border-radius: 4px; color: var(--vscode-descriptionForeground); font-size: 11px; }
</style>
</head>
<body>
<div id="crumb"></div>
<div id="hint">Click a node to drill in · drag canvas to pan · scroll to zoom</div>
<div class="legend"><b>${graph.kind}</b> · ${graph.nodes.length} nodes · ${graph.edges.length} edges</div>
<svg id="svg"></svg>
<script>
  const vscode = acquireVsCodeApi();
  const data = JSON.parse(${JSON.stringify(dataJson)});
  const path = ${pathJson};

  function colorOf(n) {
    const K = { playbook: 'var(--vscode-charts-blue)', role: 'var(--vscode-charts-orange)', play: 'var(--vscode-charts-red)', task: 'var(--vscode-charts-yellow)', handler: 'var(--vscode-charts-yellow)', group: 'var(--vscode-charts-green)', host: 'var(--vscode-charts-purple)' };
    return K[n.kind] || 'var(--vscode-foreground)';
  }

  function drillable(n) { return n.kind === 'playbook' || n.kind === 'role' || n.kind === 'play'; }

  const nodes = data.nodes.map(n => ({ id: n.id, kind: n.kind, label: n.label, sub: n.subtitle || '', color: colorOf(n) }));
  const links = data.edges.map(e => ({ source: e.source, target: e.target, label: e.label }));

  // Vanilla SVG (no external libs; CSP blocks scripts from CDNs).
  const svg = document.getElementById('svg');
  const NS = 'http://www.w3.org/2000/svg';
  let tx = 0, ty = 0, k = 1;
  const g = document.createElementNS(NS, 'g');
  svg.appendChild(g);

  function applyTransform() { g.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + k + ')'); }

  let dragging = false, sx = 0, sy = 0;
  svg.addEventListener('mousedown', e => { dragging = true; sx = e.clientX - tx; sy = e.clientY - ty; });
  window.addEventListener('mousemove', e => { if (dragging) { tx = e.clientX - sx; ty = e.clientY - sy; applyTransform(); } });
  window.addEventListener('mouseup', () => dragging = false);
  svg.addEventListener('wheel', e => { e.preventDefault(); const f = e.deltaY < 0 ? 1.1 : 0.9; k = Math.min(3, Math.max(0.3, k * f)); applyTransform(); }, { passive: false });

  // ---- deterministic tree layout ----
  const children = {};
  links.forEach(e => (children[e.source] = children[e.source] || []).push(e.target));
  const hasParent = new Set(links.map(e => e.target));
  const roots = nodes.map(n => n.id).filter(id => !hasParent.has(id));
  const pos = {};
  let orderY = 40;
  function assign(id, depth) {
    if (pos[id] !== undefined) return;
    pos[id] = { x: 110 + depth * 200, y: orderY };
    orderY += 64;
    (children[id] || []).forEach(c => assign(c, depth + 1));
  }
  roots.forEach(r => assign(r, 0));
  let leftover = 40;
  nodes.forEach(n => { if (pos[n.id] === undefined) { pos[n.id] = { x: 500, y: leftover }; leftover += 64; } });

  // ---- draw edges ----
  links.forEach(l => {
    const s = pos[l.source], t = pos[l.target];
    if (!s || !t) return;
    const mx = (s.x + t.x) / 2;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', 'edge');
    path.setAttribute('d', 'M' + s.x + ',' + s.y + ' C' + mx + ',' + s.y + ' ' + mx + ',' + t.y + ' ' + t.x + ',' + t.y);
    g.appendChild(path);
    if (l.label) {
      const lt = document.createElementNS(NS, 'text');
      lt.setAttribute('class', 'edge-lbl');
      lt.setAttribute('x', mx); lt.setAttribute('y', (s.y + t.y) / 2 - 4);
      lt.textContent = l.label;
      g.appendChild(lt);
    }
  });

  // ---- draw nodes ----
  nodes.forEach(n => {
    const p = pos[n.id];
    if (!p) return;
    const grp = document.createElementNS(NS, 'g');
    grp.setAttribute('class', 'node');
    grp.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', 11); c.setAttribute('fill', n.color);
    grp.appendChild(c);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', 18); t.setAttribute('y', 4); t.textContent = n.label;
    grp.appendChild(t);
    if (n.sub) {
      const st = document.createElementNS(NS, 'text');
      st.setAttribute('class', 'sub'); st.setAttribute('x', 18); st.setAttribute('y', 18); st.textContent = n.sub;
      grp.appendChild(st);
    }
    const tt = document.createElementNS(NS, 'title');
    tt.textContent = n.label + (n.sub ? ' — ' + n.sub : '');
    grp.appendChild(tt);
    grp.addEventListener('click', () => {
      if (drillable(n)) vscode.postMessage({ type: 'drill', kind: n.kind, label: n.label, id: n.id });
      else vscode.postMessage({ type: 'open', kind: n.kind, label: n.label, id: n.id });
    });
    g.appendChild(grp);
  });

  // ---- breadcrumbs ----
  const crumb = document.getElementById('crumb');
  crumb.innerHTML = '';
  const rootBtn = document.createElement('span');
  rootBtn.className = 'c' + (path.length === 0 ? ' active' : '');
  rootBtn.textContent = 'Overview';
  rootBtn.addEventListener('click', () => vscode.postMessage({ type: 'breadcrumb', index: 0 }));
  crumb.appendChild(rootBtn);
  path.forEach((lv, i) => {
    const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '/'; crumb.appendChild(sep);
    const b = document.createElement('span');
    b.className = 'c' + (i === path.length - 1 ? ' active' : '');
    b.textContent = lv.key;
    b.addEventListener('click', () => vscode.postMessage({ type: 'breadcrumb', index: i + 1 }));
    crumb.appendChild(b);
  });
</script>
</body>
</html>`;
}

export class GraphPanel {
  public static current: GraphPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private projectRoot: string;
  private path: Level[] = [];

  private constructor(panel: vscode.WebviewPanel, projectRoot: string) {
    this.panel = panel;
    this.projectRoot = projectRoot;
    panel.onDidDispose(() => {
      GraphPanel.current = undefined;
    });
    panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg), undefined, []);
  }

  /** Returns the current folder from which graphs are built. */
  private get root(): string {
    return this.projectRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  }

  private overview(): GraphData {
    // Reuse the roles graph as the overview (playbooks + their roles).
    return shapeRoles(this.root);
  }

  private renderCurrent(): void {
    const graph = this.path.length === 0 ? this.overview() : this.graphForLevel(this.path[this.path.length - 1]!);
    this.panel.title = 'Ansible graph — ' + (this.path.length === 0 ? 'overview' : this.path[this.path.length - 1]!.key);
    this.panel.webview.html = renderGraphHtml(graph, this.path);
  }

  private graphForLevel(level: Level): GraphData {
    if (level.kind === 'playbook') return shapePlaybookDetail(this.root, level.key);
    // Role drill-down: reuse playbook detail on a synthetic playbook is not
    // right; fall back to overview-ish role graph.
    return shapePlaybookDetail(this.root, level.key);
  }

  private onMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'drill') {
      const kind = String(msg.kind ?? '');
      const label = String(msg.label ?? '');
      if (kind === 'playbook') {
        this.path.push({ kind: 'playbook', key: label });
      } else if (kind === 'role') {
        this.path.push({ kind: 'role', key: label });
      } else if (kind === 'play') {
        this.path.push({ kind: 'playbook', key: this.path[this.path.length - 1]?.key ?? '' });
      }
      this.renderCurrent();
    } else if (msg.type === 'breadcrumb') {
      const idx = Number(msg.index ?? 0);
      this.path = this.path.slice(0, idx);
      this.renderCurrent();
    } else if (msg.type === 'open') {
      // Open the underlying file for a task/role/playbook node.
      const kind = String(msg.kind ?? '');
      const id = String(msg.id ?? '');
      if (kind === 'playbook' && GraphPanel.onOpenNode) {
        GraphPanel.onOpenNode({ kind, id, fsPath: this.root + '/' + id.replace(/^playbook:/, '') });
      }
    }
  }

  /** Callback for opening a file from a graph node. */
  public static onOpenNode: ((node: { kind: string; id: string; fsPath?: string }) => void) | undefined;

  public static createOrShow(extensionUri: vscode.Uri, projectRoot: string): void {
    if (GraphPanel.current) {
      GraphPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'ansibleGraph',
      'Ansible graph — overview',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    GraphPanel.current = new GraphPanel(panel, projectRoot);
    GraphPanel.current.renderCurrent();
  }
}

/** Builds the roles graph for the project root. */
export function buildRolesGraph(projectRoot: string): GraphData {
  return shapeRoles(projectRoot);
}
