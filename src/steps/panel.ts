import * as vscode from 'vscode';
import * as path from 'node:path';
import { listTasks, runPlaybookCapturing } from '../runner';
import { parseTaskTree, type PlayBlock, type TaskStep } from '../debug/pure';

interface ClientTask {
  i: number;
  name: string;
  play: string;
}

function flatten(plays: PlayBlock[]): ClientTask[] {
  const out: ClientTask[] = [];
  let counter = 0;
  const walk = (tasks: TaskStep[], play: string) => {
    for (const t of tasks) {
      out.push({ i: counter++, name: t.name, play });
      walk(t.children, play);
    }
  };
  for (const p of plays) walk(p.tasks, p.name);
  return out;
}

function renderHtml(plays: PlayBlock[], playbookPath: string): string {
  const tasks = flatten(plays);
  const json = JSON.stringify(tasks).replace(/</g, '\\u003c');
  const playsJson = JSON.stringify(
    plays.map((p) => ({ name: p.name, hosts: p.hosts })),
  ).replace(/</g, '\\u003c');
  const label = path.basename(playbookPath);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  :root {
    color-scheme: light dark;
  }
  body {
    margin: 0;
    background: var(--vscode-editor-background);
    color: var(--vscode-foreground);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  header {
    padding: 10px 14px;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
    background: var(--vscode-editor-background);
  }
  header h1 {
    font-size: 14px;
    margin: 0 0 4px;
    font-weight: 600;
  }
  header .sub {
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
  }
  #controls {
    padding: 8px 14px;
    display: flex;
    gap: 8px;
    align-items: center;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
  }
  #controls button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 2px;
    padding: 4px 12px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
  }
  #controls button:hover { background: var(--vscode-button-hoverBackground); }
  #controls button:disabled {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    cursor: default;
  }
  #tasks { flex: 1; overflow-y: auto; padding: 8px 0; }
  .play {
    padding: 8px 14px;
    font-weight: 600;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-inactiveSelectionBackground, transparent);
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
    margin-top: 4px;
  }
  .play .hosts { font-weight: 400; color: var(--vscode-descriptionForeground); margin-left: 8px; }
  .task {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 14px;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
    opacity: 0.55;
  }
  .task .idx {
    color: var(--vscode-descriptionForeground);
    min-width: 22px;
    text-align: right;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    line-height: 1.6;
  }
  .task .body { flex: 1; min-width: 0; }
  .task .name { word-break: break-word; }
  .task .children {
    margin-left: 12px;
    padding-left: 8px;
    border-left: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
  }
  .task .status { font-size: 11px; margin-top: 2px; }
  .task.running { opacity: 1; }
  .task.done { opacity: 1; }
  .task.failed { opacity: 1; }
  .task.failed .status { color: var(--vscode-errorForeground); }
  .task.ok .status { color: var(--vscode-testing-iconPassed, var(--vscode-charts-green)); }
  .task.skipped .status { color: var(--vscode-descriptionForeground); }
  .status-line { white-space: pre-wrap; font-family: var(--vscode-editor-font-family, monospace); }
  .run-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 2px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 11px;
    flex-shrink: 0;
  }
  .run-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .run-btn:disabled { opacity: 0.5; cursor: default; }
</style>
</head>
<body>
<header>
  <h1>Step runner — ${label}</h1>
  <div class="sub" id="info">Tasks resolve as roles and includes expand into subtasks.</div>
</header>
<div id="controls">
  <button id="run-all" disabled>Run all</button>
  <span class="sub">Click a step to run from it.</span>
</div>
<div id="tasks"></div>
<script>
  const vscode = acquireVsCodeApi();
  const tasks = ${json};
  const plays = ${playsJson};
  const list = document.getElementById('tasks');
  const info = document.getElementById('info');
  const runAll = document.getElementById('run-all');
  let current = -1;
  let running = false;

  function render() {
    list.innerHTML = '';
    for (const p of plays) {
      const playEl = document.createElement('div');
      playEl.className = 'play';
      playEl.textContent = p.name;
      const hosts = document.createElement('span');
      hosts.className = 'hosts';
      hosts.textContent = p.hosts ? '(' + p.hosts + ')' : '';
      playEl.appendChild(hosts);
      list.appendChild(playEl);
      for (const t of tasks) {
        if (t.play !== p.name) continue;
        const el = buildTask(t);
        list.appendChild(el);
      }
    }
    runAll.disabled = running;
    if (current >= 0 && current < tasks.length) {
      info.textContent = 'Status: step ' + (current + 1) + '/' + tasks.length;
    }
  }

  function buildTask(t) {
    const el = document.createElement('div');
    const cls = ['task'];
    if (t.i === current) cls.push('running');
    if (t.state === 'failed') cls.push('failed');
    else if (t.state === 'ok' || t.state === 'changed') cls.push('ok');
    else if (t.state === 'skipped') cls.push('skipped');
    if (t.state && t.state !== 'failed') cls.push('done');
    el.className = cls.join(' ');

    const idx = document.createElement('span');
    idx.className = 'idx';
    idx.textContent = (t.i + 1) + '.';
    el.appendChild(idx);

    const body = document.createElement('div');
    body.className = 'body';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = t.name;
    body.appendChild(name);

    if (t.state) {
      const status = document.createElement('div');
      status.className = 'status';
      status.textContent = t.state;
      body.appendChild(status);
    }

    el.appendChild(body);

    const btn = document.createElement('button');
    btn.className = 'run-btn';
    btn.textContent = running ? '···' : 'run';
    btn.disabled = running || t.i < current;
    btn.addEventListener('click', () => run(t.i));
    el.appendChild(btn);

    return el;
  }

  function run(i) {
    if (running) return;
    current = i;
    running = true;
    const t = tasks[i];
    vscode.postMessage({ type: 'run', index: i, name: t.name });
    render();
    info.textContent = 'Running from step ' + (i + 1) + ' — ' + t.name;
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'task-output') {
      const t = tasks.find((x) => x.i === msg.index);
      if (t) {
        t.state = msg.state;
        t.output = msg.output;
      }
      render();
    }
    if (msg.type === 'progress') {
      current = msg.index;
      render();
    }
    if (msg.type === 'done') {
      running = false;
      current = msg.index;
      info.textContent = msg.error
        ? ('Error: ' + msg.error)
        : ('Completed [' + (msg.index + 1) + '/' + tasks.length + ']');
      render();
    }
  });

  runAll.addEventListener('click', () => run(0));
  render();
</script>
</body>
</html>`;
}

export class StepsPanel {
  public static current: StepsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private playbookPath: string;

  private constructor(panel: vscode.WebviewPanel, playbookPath: string) {
    this.panel = panel;
    this.playbookPath = playbookPath;
    panel.onDidDispose(() => (StepsPanel.current = undefined));
    panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg), undefined, []);
  }

  public static async createOrShow(playbookPath: string): Promise<void> {
    if (!playbookPath) {
      void vscode.window.showWarningMessage('Open a playbook first.');
      return;
    }
    const output = await listTasks(playbookPath);
    const plays = parseTaskTree(output);

    if (StepsPanel.current) {
      void StepsPanel.current.panel.webview.postMessage({ type: 'reload', plays });
      StepsPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'ansibleSteps',
      'Ansible step runner',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.webview.html = renderHtml(plays, playbookPath);
    StepsPanel.current = new StepsPanel(panel, playbookPath);
  }

  private onMessage(msg: Record<string, unknown>): void {
    if (msg.type !== 'run') return;
    const index = Number(msg.index ?? 0);
    const name = String(msg.name ?? '');
    void this.runFromTask(index, name);
  }

  private async runFromTask(index: number, name: string): Promise<void> {
    const send = (m: Record<string, unknown>) => void this.panel.webview.postMessage(m);

    let currentTaskIndex = index;
    let currentState = 'running';
    let lastError = '';

    // eslint-disable-next-line no-control-regex
    const ansiRe = new RegExp('\u001b\\[[0-9;]*m', 'g');

    await runPlaybookCapturing(
      this.playbookPath,
      ['--start-at-task', `"${name}"`],
      (line) => {
        const stripped = line.replace(ansiRe, '').trim();
        // A new task header advances the current step (ansible prints
        // "TASK [name]" before each task's output).
        const taskMatch = stripped.match(/^TASK \[(.*?)\]/);
        if (taskMatch) {
          currentTaskIndex += 1;
          currentState = 'running';
        }
        const lower = stripped.toLowerCase();
        if (stripped.startsWith('fatal:')) {
          currentState = 'failed';
          lastError = stripped;
        } else if (/^(ok|changed|skipping):/.test(lower)) {
          currentState = lower.startsWith('skipping') ? 'skipped' : lower.startsWith('changed') ? 'changed' : 'ok';
        }
        send({
          type: 'task-output',
          index: currentTaskIndex - 1,
          state: currentState,
          output: stripped,
        });
      },
    );

    send({ type: 'done', index: currentTaskIndex - 1, error: lastError });
  }
}
