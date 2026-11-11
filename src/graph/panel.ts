import * as vscode from 'vscode';
import { shapePlaybookDetail, shapeRoles } from './pure';
import type { GraphData } from './pure';
import { subscribeRuntime } from '../runtime/bus';
import type { Status } from '../runtime/bus';

/**
 * A drill-down graph drawn as a UML interaction diagram: nodes are stereotyped
 * boxes (playbook / play / role / task), edges are directed with typed labels
 * (contains, uses, notifies, imports). Single-click opens the file for editing;
 * double-click drills into a node. Breadcrumbs walk back up.
 */

type Level = { kind: 'overview' | 'playbook'; key: string };

function renderGraphHtml(graph: GraphData, path: Level[], statusById: Record<string, string>): string {
  const dataJson = JSON.stringify(graph).replace(/</g, '\\u003c');
  const pathJson = JSON.stringify(path).replace(/</g, '\\u003c');
  const statusJson = JSON.stringify(statusById).replace(/</g, '\\u003c');
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
  .node rect { stroke: var(--vscode-panel-border); stroke-width: 1.2; cursor: pointer; }
  .node .stereo { font-size: 9px; fill: var(--vscode-descriptionForeground); font-family: var(--vscode-font-family); }
  .node .name { font-size: 12px; fill: var(--vscode-foreground); pointer-events: none; }
  .node .sub { font-size: 10px; fill: var(--vscode-descriptionForeground); }
  .edge { stroke: var(--vscode-foreground); stroke-opacity: 0.45; fill: none; }
  .edge-arrow { fill: var(--vscode-foreground); opacity: 0.45; }
  .edge-lbl { font-size: 10px; fill: var(--vscode-descriptionForeground); font-family: var(--vscode-font-family); }
  .legend { position: fixed; top: 46px; right: 12px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 6px 10px; border-radius: 4px; color: var(--vscode-descriptionForeground); font-size: 11px; }
</style>
</head>
<body>
<div id="crumb"></div>
<div id="hint">Click a node to open it in the editor · double-click to drill in · drag canvas to pan · scroll to zoom</div>
<div class="legend"><b>${graph.kind}</b> · ${graph.nodes.length} nodes · ${graph.edges.length} edges</div>
<svg id="svg"></svg>
<script>
  const vscode = acquireVsCodeApi();
  const data = JSON.parse(${JSON.stringify(dataJson)});
  const path = ${pathJson};
  const statusById = ${statusJson};

  const STEREO = { playbook: '«playbook»', play: '«play»', role: '«role»', task: '«task»', group: '«group»', host: '«host»' };
  const STATUS_COLOR = { ok: 'var(--vscode-charts-green)', changed: 'var(--vscode-charts-yellow)', failed: 'var(--vscode-errorForeground)', unreachable: 'var(--vscode-descriptionForeground)', skipped: 'var(--vscode-charts-blue)' };
  function colorOf(n) {
    if (n.kind === 'task' && statusById[n.label]) return STATUS_COLOR[statusById[n.label]] || 'var(--vscode-foreground)';
    const K = { playbook: 'var(--vscode-charts-blue)', role: 'var(--vscode-charts-orange)', play: 'var(--vscode-charts-red)', task: 'var(--vscode-charts-yellow)', group: 'var(--vscode-charts-green)', host: 'var(--vscode-charts-purple)' };
    return K[n.kind] || 'var(--vscode-foreground)';
  }
  function drillable(n) { return n.kind === 'playbook' || n.kind === 'role'; }

  const nodes = data.nodes.map(n => ({ id: n.id, kind: n.kind, label: n.label, sub: n.subtitle || '', file: (n.data && n.data.file) || '', color: colorOf(n) }));
  const links = data.edges.map(e => ({ source: e.source, target: e.target, label: e.label }));

  // ---- SVG setup ----
  const svg = document.getElementById('svg');
  const NS = 'http://www.w3.org/2000/svg';
  let tx = 20, ty = 70, k = 1;
  const g = document.createElementNS(NS, 'g');
  svg.appendChild(g);
  function applyTransform() { g.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + k + ')'); }

  let dragging = false, sx = 0, sy = 0;
  svg.addEventListener('mousedown', e => { dragging = true; sx = e.clientX - tx; sy = e.clientY - ty; });
  window.addEventListener('mousemove', e => { if (dragging) { tx = e.clientX - sx; ty = e.clientY - sy; applyTransform(); } });
  window.addEventListener('mouseup', () => dragging = false);
  svg.addEventListener('wheel', e => { e.preventDefault(); const f = e.deltaY < 0 ? 1.1 : 0.9; k = Math.min(3, Math.max(0.3, k * f)); applyTransform(); }, { passive: false });

  // ---- deterministic layered layout (UML left-to-right) ----
  const children = {};
  links.forEach(e => (children[e.source] = children[e.source] || []).push(e.target));
  const hasParent = new Set(links.map(e => e.target));
  const roots = nodes.map(n => n.id).filter(id => !hasParent.has(id));
  const depth = {};
  (function assignDepth(id, d) {
    if (depth[id] !== undefined) { depth[id] = Math.max(depth[id], d); return; }
    depth[id] = d;
    (children[id] || []).forEach(c => assignDepth(c, d + 1));
  });
  roots.forEach(r => assignDepth(r, 0));
  nodes.forEach(n => { if (depth[n.id] === undefined) depth[n.id] = 0; });
  const pos = {};
  // y = running slot per depth column; x = depth column.
  const colY = {};
  nodes.forEach(n => {
    const d = depth[n.id];
    const slot = colY[d] = (colY[d] || 0);
    pos[n.id] = { x: 40 + d * 240, y: 40 + slot * 90 };
    colY[d] += 1;
  });

  const BOX = { playbook: 150, play: 130, role: 120, task: 170, group: 110, host: 90 };
  const H = { playbook: 50, play: 50, role: 46, task: 50, group: 46, host: 46 };

  // ---- draw edges (directed, with arrowhead) ----
  links.forEach(l => {
    const s = pos[l.source], t = pos[l.target];
    if (!s || !t) return;
    let x1 = s.x, y1 = s.y, x2 = t.x, y2 = t.y;
    // Connect box borders vertically when nodes are stacked in one column.
    if (Math.abs(s.x - t.x) < 5) {
      y1 = s.y + H[nodes.find(n => n.id === l.source)?.kind || 'task'] / 2;
      y2 = t.y - H[nodes.find(n => n.id === l.target)?.kind || 'task'] / 2;
    }
    const mx = (x1 + x2) / 2;
    const d = 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', 'edge');
    p.setAttribute('d', d);
    g.appendChild(p);

    // Arrowhead triangle at target (pointing along the edge direction).
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const arrow = document.createElementNS(NS, 'polygon');
    arrow.setAttribute('class', 'edge-arrow');
    const tipX = x2, tipY = y2;
    const back = 9;
    arrow.setAttribute('points',
      tipX + ',' + tipY + ' ' +
      (tipX - back * Math.cos(ang - 0.4)) + ',' + (tipY - back * Math.sin(ang - 0.4)) + ' ' +
      (tipX - back * Math.cos(ang + 0.4)) + ',' + (tipY - back * Math.sin(ang + 0.4)));
    g.appendChild(arrow);

    if (l.label) {
      const lt = document.createElementNS(NS, 'text');
      lt.setAttribute('class', 'edge-lbl');
      lt.setAttribute('x', mx); lt.setAttribute('y', (y1 + y2) / 2 - 6); lt.textContent = l.label; g.appendChild(lt);
    }
  });

  // ---- draw nodes as UML boxes with stereotype ----
  nodes.forEach(n => {
    const p = pos[n.id];
    if (!p) return;
    const bw = BOX[n.kind] || 140, bh = H[n.kind] || 46;
    const grp = document.createElementNS(NS, 'g');
    grp.setAttribute('class', 'node');
    grp.setAttribute('transform', 'translate(' + (p.x - bw / 2) + ',' + (p.y - bh / 2) + ')');

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('width', bw); rect.setAttribute('height', bh);
    rect.setAttribute('rx', 3);
    rect.setAttribute('fill', n.color);
    grp.appendChild(rect);

    const st = document.createElementNS(NS, 'text');
    st.setAttribute('class', 'stereo'); st.setAttribute('x', 6); st.setAttribute('y', 14);
    st.textContent = STEREO[n.kind] || n.kind;
    grp.appendChild(st);

    const name = document.createElementNS(NS, 'text');
    name.setAttribute('class', 'name'); name.setAttribute('x', 6); name.setAttribute('y', 30);
    name.textContent = n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label;
    grp.appendChild(name);

    if (n.sub) {
      const sub = document.createElementNS(NS, 'text');
      sub.setAttribute('class', 'sub'); sub.setAttribute('x', 6); sub.setAttribute('y', bh - 4);
      sub.textContent = n.sub;
      grp.appendChild(sub);
    }

    const tt = document.createElementNS(NS, 'title');
    tt.textContent = (STEREO[n.kind] || n.kind) + ' ' + n.label + (n.sub ? ' — ' + n.sub : '') + (n.file ? ' (' + n.file + ')' : '');
    grp.appendChild(tt);

    grp.addEventListener('click', () => {
      if (n.file) vscode.postMessage({ type: 'open', kind: n.kind, id: n.id, file: n.file });
    });
    grp.addEventListener('dblclick', () => {
      if (drillable(n)) vscode.postMessage({ type: 'drill', kind: n.kind, label: n.label, id: n.id });
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
  private statusById: Record<string, Status | undefined> = {};

  private constructor(panel: vscode.WebviewPanel, projectRoot: string) {
    this.panel = panel;
    this.projectRoot = projectRoot;
    panel.onDidDispose(() => {
      GraphPanel.current = undefined;
    });
    panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg), undefined, []);
    subscribeRuntime((e) => {
      if (e.kind === 'result' && e.status) {
        this.statusById[e.label] = e.status;
        this.renderCurrent();
      }
    });
  }

  private get root(): string {
    return this.projectRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  }

  private overview(): GraphData {
    return shapeRoles(this.root);
  }

  private renderCurrent(): void {
    const graph = this.path.length === 0 ? this.overview() : this.graphForLevel(this.path[this.path.length - 1]!);
    this.panel.title = 'Ansible graph — ' + (this.path.length === 0 ? 'overview' : this.path[this.path.length - 1]!.key);
    const statusMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.statusById)) if (v) statusMap[k] = v;
    this.panel.webview.html = renderGraphHtml(graph, this.path, statusMap);
  }

  private graphForLevel(level: Level): GraphData {
    return shapePlaybookDetail(this.root, level.key);
  }

  private onMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'drill') {
      const kind = String(msg.kind ?? '');
      const label = String(msg.label ?? '');
      if (kind === 'playbook') {
        // Guard against re-entering the same playbook (self-drill loop).
        if (this.path.some((p) => p.kind === 'playbook' && p.key === label)) return;
        this.path.push({ kind: 'playbook', key: label });
        this.renderCurrent();
      } else if (kind === 'role') {
        // A role has no standalone drill-down view; open its file instead.
        void vscode.window.showTextDocument(vscode.Uri.file(this.root + '/roles/' + label + '/tasks/main.yml'));
      }
    } else if (msg.type === 'breadcrumb') {
      const idx = Number(msg.index ?? 0);
      this.path = this.path.slice(0, idx);
      this.renderCurrent();
    } else if (msg.type === 'open') {
      const file = String(msg.file ?? '');
      if (file) {
        void vscode.window.showTextDocument(vscode.Uri.file(file));
      }
    }
  }

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
