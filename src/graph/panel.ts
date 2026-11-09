import * as vscode from 'vscode';
import { shapeRoles } from './pure';
import type { GraphData } from './pure';

const STATUS_COLORS: Record<string, string> = {
  ok: '#4caf50',
  changed: '#ffc107',
  failed: '#f44336',
  unreachable: '#9e9e9e',
  skipped: '#2196f3',
  ignored: '#9c27b0',
};

function renderGraphHtml(graph: GraphData): string {
  const dataJson = JSON.stringify(graph).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  body { margin: 0; background: #1e1e1e; font-family: -apple-system, Segoe UI, sans-serif; overflow: hidden; }
  svg { width: 100vw; height: 100vh; }
  .node circle { stroke: #ffffff22; stroke-width: 1.5; }
  .node text { fill: #e0e0e0; font-size: 12px; pointer-events: none; }
  .edge { stroke: #ffffff44; stroke-opacity: 0.4; fill: none; }
  .edge.label { font-size: 10px; fill: #9e9e9e; }
  .legend { position: fixed; top: 12px; left: 12px; background: #252526cc; border: 1px solid #ffffff22; padding: 8px 12px; border-radius: 6px; color: #ccc; font-size: 12px; }
  .legend b { color: #fff; }
</style>
</head>
<body>
<div class="legend"><b>${graph.kind}</b> · узлов ${graph.nodes.length} · связей ${graph.edges.length}</div>
<svg id="svg"></svg>
<script>
  const data = JSON.parse(${JSON.stringify(dataJson)});
  const width = window.innerWidth;
  const height = window.innerHeight;

  const nodes = data.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, color: colorOf(n) }));
  function colorOf(n) {
    const map = ${JSON.stringify(STATUS_COLORS)};
    if (n.status) return map[n.status] || '#607d8b';
    switch (n.kind) {
      case 'playbook': return '#00bcd4';
      case 'role': return '#ff6d00';
      case 'group': return '#4caf50';
      case 'host': return '#2196f3';
      case 'task': return '#9c27b0';
      case 'play': return '#3f51b5';
      default: return '#607d8b';
    }
  }
  const links = data.edges.map(e => ({ source: e.source, target: e.target, label: e.label }));

  const svg = d3.select('#svg');
  const g = svg.append('g');

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(90))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2));

  const edge = g.append('g').selectAll('line')
    .data(links).join('line')
    .attr('class', 'edge');

  const node = g.append('g').selectAll('g')
    .data(nodes).join('g')
    .attr('class', 'node')
    .call(drag(simulation));

  node.append('circle').attr('r', 10).attr('fill', d => d.color);
  node.append('text').attr('x', 14).attr('y', 4).text(d => d.label);

  node.append('title').text(d => d.label);

  simulation.on('tick', () => {
    edge.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
  });

  function drag(sim) {
    function started(event, d) { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function ended(event, d) { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }
    return d3.drag().on('start', started).on('drag', dragged).on('end', ended);
  }
</script>
</body>
</html>`;
}

export class GraphPanel {
  public static current: GraphPanel | undefined;

  private readonly panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel, graph: GraphData) {
    this.panel = panel;
    this.update(graph);
    panel.onDidDispose(() => {
      GraphPanel.current = undefined;
    });
  }

  public static createOrShow(extensionUri: vscode.Uri, graph: GraphData): void {
    if (GraphPanel.current) {
      GraphPanel.current.update(graph);
      GraphPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'ansibleGraph',
      `Граф Ansible — ${graph.kind}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.webview.html = renderGraphHtml(graph);
    GraphPanel.current = new GraphPanel(panel, graph);
    panel.onDidDispose(() => (GraphPanel.current = undefined));
  }

  private update(graph: GraphData): void {
    this.panel.title = `Граф Ansible — ${graph.kind}`;
    this.panel.webview.html = renderGraphHtml(graph);
  }
}

/** Строит граф ролей для корня проекта. */
export function buildRolesGraph(projectRoot: string): GraphData {
  return shapeRoles(projectRoot);
}
