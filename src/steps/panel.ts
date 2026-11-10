import * as vscode from 'vscode';
import * as path from 'node:path';
import { listTasks, runPlaybookInTerminal } from '../runner';
import { parseTaskNames } from '../debug/pure';

function renderHtml(tasks: string[], playbookPath: string): string {
  const json = JSON.stringify(tasks.map((t) => ({ name: t }))).replace(/</g, '\\u003c');
  const label = path.basename(playbookPath);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  body { margin:0; background:#1e1e1e; color:#e0e0e0; font-family:-apple-system,Segoe UI,sans-serif; font-size:13px; display:flex; flex-direction:column; height:100vh; }
  header { padding:10px 14px; border-bottom:1px solid #ffffff22; background:#252526; }
  header h1 { font-size:14px; margin:0 0 4px; }
  header .sub { color:#9e9e9e; font-size:12px; }
  #tasks { flex:1; overflow-y:auto; padding:10px; }
  .task { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid #ffffff11; }
  .task .idx { color:#9e9e9e; min-width:24px; text-align:right; font-family:monospace; }
  .task .name { flex:1; }
  .task button { background:#ff6d00; color:#000; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-weight:600; }
  .task.running button { background:#555; color:#ccc; cursor:default; }
</style>
</head>
<body>
<header>
  <h1>Step runner — ${label}</h1>
  <div class="sub" id="info"></div>
</header>
<div id="tasks"></div>
<script>
  const vscode = acquireVsCodeApi();
  const tasks = ${json};
  const list = document.getElementById('tasks');
  const info = document.getElementById('info');
  let current = -1;

  function render() {
    list.innerHTML = '';
    tasks.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'task' + (i === current ? ' running' : '');
      const idx = document.createElement('span'); idx.className = 'idx'; idx.textContent = (i + 1) + '.';
      const name = document.createElement('span'); name.className = 'name'; name.textContent = t.name;
      const btn = document.createElement('button');
      btn.textContent = i <= current ? 'done' : 'run';
      btn.disabled = i <= current;
      btn.addEventListener('click', () => run(i));
      el.appendChild(idx); el.appendChild(name); el.appendChild(btn);
      list.appendChild(el);
    });
  }

  function run(i) {
    current = i;
    vscode.postMessage({ type: 'run', index: i, name: tasks[i].name });
    render();
    info.textContent = 'Running [' + (i + 1) + '/' + tasks.length + '] ' + tasks[i].name;
  }

  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'progress') {
      current = msg.index;
      render();
      info.textContent = 'Completed [' + (msg.index + 1) + '/' + tasks.length + ']';
    }
  });

  render();
</script>
</body>
</html>`;
}

export class StepsPanel {
  public static current: StepsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    panel.onDidDispose(() => (StepsPanel.current = undefined));
    panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg), undefined, []);
  }

  public static async createOrShow(playbookPath: string): Promise<void> {
    if (!playbookPath) {
      void vscode.window.showWarningMessage('Open a playbook first.');
      return;
    }
    const output = await listTasks(playbookPath);
    const names = parseTaskNames(output);

    if (StepsPanel.current) {
      void StepsPanel.current.panel.webview.postMessage({ type: 'reload', tasks: names });
      StepsPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'ansibleSteps',
      'Ansible step runner',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.webview.html = renderHtml(names, playbookPath);
    StepsPanel.current = new StepsPanel(panel);
  }

  private onMessage(msg: Record<string, unknown>): void {
    if (msg.type !== 'run') return;
    const index = Number(msg.index ?? 0);
    const name = String(msg.name ?? '');
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    // Run from this task via --start-at-task, sequentially to the end.
    runPlaybookInTerminal(editor.document.uri.fsPath, ['--start-at-task', `"${name}"`]);
    void this.panel.webview.postMessage({ type: 'progress', index });
  }
}
