import * as vscode from 'vscode';
import { shapeRoles } from './pure';
import type { GraphData } from './pure';

function renderGraphHtml(graph: GraphData): string {
  const dataJson = JSON.stringify(graph).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  body { margin: 0; background: var(--vscode-editor-background); font-family: var(--vscode-font-family, -apple-system, Segoe UI, sans-serif); overflow: hidden; }
  svg { width: 100vw; height: 100vh; }
  .node circle { stroke: var(--vscode-panel-border, transparent); stroke-width: 1.5; }
  .node text { fill: var(--vscode-foreground); font-size: 12px; pointer-events: none; }
  .edge { stroke: var(--vscode-foreground); stroke-opacity: 0.35; fill: none; }
  .edge.label { font-size: 10px; fill: var(--vscode-descriptionForeground); }
  .legend { position: fixed; top: 12px; left: 12px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 8px 12px; border-radius: 6px; color: var(--vscode-descriptionForeground); font-size: 12px; }
  .legend b { color: var(--vscode-foreground); }
</style>
</head>
<body>
<div class="legend"><b>${graph.kind}</b> · nodes ${graph.nodes.length} · edges ${graph.edges.length}</div>
<svg id="svg"></svg>
<script>
  const vscode = acquireVsCodeApi();
  const data = JSON.parse(${JSON.stringify(dataJson)});
  const width = window.innerWidth;
  const height = window.innerHeight;

  const KINDS = {
    playbook: 'var(--vscode-charts-blue)', role: 'var(--vscode-charts-orange)',
    group: 'var(--vscode-charts-green)', host: 'var(--vscode-charts-purple)',
    task: 'var(--vscode-charts-yellow)', play: 'var(--vscode-charts-red)',
  };
  const STATUS = {
    ok: 'var(--vscode-charts-green)', changed: 'var(--vscode-charts-yellow)',
    failed: 'var(--vscode-errorForeground)', unreachable: 'var(--vscode-descriptionForeground)',
    skipped: 'var(--vscode-charts-blue)', ignored: 'var(--vscode-charts-purple)',
  };
  function colorOf(n) {
    if (n.status) return STATUS[n.status] || 'var(--vscode-foreground)';
    return KINDS[n.kind] || 'var(--vscode-foreground)';
  }
  const nodes = data.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, color: colorOf(n) }));
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

  node.on('click', (event, d) => {
    vscode.postMessage({ type: 'selectNode', id: d.id, label: d.label, kind: d.kind });
  });

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
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'selectNode' && typeof GraphPanel.onSelectNode === 'function') {
        GraphPanel.onSelectNode({
          id: String(msg.id ?? ''),
          label: String(msg.label ?? ''),
          kind: String(msg.kind ?? ''),
        });
      }
    }, undefined, []);
  }

  /** Callback invoked when the user clicks a node in the graph. */
  public static onSelectNode: ((node: { id: string; label: string; kind: string }) => void) | undefined;

  public static createOrShow(extensionUri: vscode.Uri, graph: GraphData): void {
    if (GraphPanel.current) {
      GraphPanel.current.update(graph);
      GraphPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'ansibleGraph',
      `Ansible graph — ${graph.kind}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.webview.html = renderGraphHtml(graph);
    GraphPanel.current = new GraphPanel(panel, graph);
    panel.onDidDispose(() => (GraphPanel.current = undefined));
  }

  private update(graph: GraphData): void {
    this.panel.title = `Ansible graph — ${graph.kind}`;
    this.panel.webview.html = renderGraphHtml(graph);
  }
}

/** Builds the roles graph for the project root. */
export function buildRolesGraph(projectRoot: string): GraphData {
  return shapeRoles(projectRoot);
}
