import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  generateTaskYaml,
  generatePlaybookYaml,
  generateRoleFiles,
  listModuleNames,
  listModuleOptions,
} from './generate';

function renderHtml(): string {
  const modules = listModuleNames();
  const modulesJson = JSON.stringify(modules).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  :root { --bg:#1e1e1e; --panel:#252526; --border:#ffffff22; --text:#e0e0e0; --muted:#9e9e9e; --accent:#ff6d00; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,Segoe UI,sans-serif; font-size:13px; display:flex; flex-direction:column; height:100vh; }
  header { padding:10px 14px; border-bottom:1px solid var(--border); background:var(--panel); display:flex; gap:8px; align-items:center; }
  header h1 { font-size:14px; margin:0; flex:1; }
  .tab { padding:6px 12px; background:transparent; border:1px solid var(--border); color:var(--text); border-radius:4px; cursor:pointer; }
  .tab.active { background:var(--accent); border-color:var(--accent); color:#000; }
  main { flex:1; overflow-y:auto; padding:14px; }
  .field { margin-bottom:12px; }
  .field label { display:block; margin-bottom:4px; color:var(--muted); font-size:12px; }
  .field input, .field select, .field textarea { width:100%; background:#3c3c3c; border:1px solid var(--border); color:var(--text); padding:6px 8px; border-radius:4px; font-size:13px; font-family:inherit; }
  .field textarea { min-height:60px; resize:vertical; font-family:ui-monospace,Menlo,Consolas,monospace; }
  .row { display:flex; gap:8px; }
  .row .field { flex:1; }
  .opt { display:flex; gap:6px; margin-bottom:6px; align-items:center; }
  .opt input { flex:1; }
  .opt button { background:#3c3c3c; border:1px solid var(--border); color:var(--text); border-radius:4px; cursor:pointer; width:28px; }
  button.primary { background:var(--accent); color:#000; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:600; }
  button.ghost { background:transparent; border:1px solid var(--border); color:var(--text); padding:8px 16px; border-radius:4px; cursor:pointer; }
  pre { background:var(--panel); border:1px solid var(--border); border-radius:4px; padding:10px; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px; white-space:pre-wrap; }
  .muted { color:var(--muted); font-size:12px; }
</style>
</head>
<body>
<header>
  <h1>Ansible Playbook Builder</h1>
  <button class="tab active" data-tab="task" id="tab-task">Task</button>
  <button class="tab" data-tab="playbook" id="tab-playbook">Playbook</button>
  <button class="tab" data-tab="role" id="tab-role">Role</button>
</header>
<main>
  <!-- TASK -->
  <section id="sec-task">
    <div class="field"><label>Task name</label><input id="task-name" placeholder="Install nginx"/></div>
    <div class="field"><label>Module</label>
      <input id="task-module" list="modules-list" placeholder="apt, yum, copy, ..."/>
      <datalist id="modules-list"></datalist>
    </div>
    <div id="task-options"></div>
    <button id="task-add-opt" class="ghost">+ option</button>
    <div class="muted" id="task-doc"></div>
    <div style="margin-top:14px"><button id="task-generate" class="primary">Insert into editor</button></div>
    <pre id="task-preview" style="margin-top:14px"></pre>
  </section>
  <!-- PLAYBOOK -->
  <section id="sec-playbook" style="display:none">
    <div class="field"><label>Play name</label><input id="pb-name" placeholder="Configure webservers"/></div>
    <div class="row">
      <div class="field"><label>Hosts</label><input id="pb-hosts" value="all"/></div>
      <div class="field"><label>Roles (comma-separated)</label><input id="pb-roles" placeholder="webserver, db"/></div>
    </div>
    <div class="row">
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="pb-become" checked/> become</label>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="pb-facts" checked/> gather_facts</label>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="pb-vault"/> vault vars_files</label>
    </div>
    <div style="margin-top:14px"><button id="pb-generate" class="primary">Insert into editor</button></div>
    <pre id="pb-preview" style="margin-top:14px"></pre>
  </section>
  <!-- ROLE -->
  <section id="sec-role" style="display:none">
    <div class="field"><label>Role name</label><input id="role-name" placeholder="my_role"/></div>
    <div class="row">
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="role-meta" checked/> meta/main.yml</label>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="role-tpl" checked/> templates/</label>
    </div>
    <div style="margin-top:14px"><button id="role-generate" class="primary">Create role files</button></div>
    <pre id="role-preview" style="margin-top:14px"></pre>
  </section>
</main>
<script>
  const vscode = acquireVsCodeApi();
  const MODULES = ${modulesJson};
  const modulesList = document.getElementById('modules-list');
  MODULES.forEach(m => { const o = document.createElement('option'); o.value = m; modulesList.appendChild(o); });

  function setTab(t) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.id === 'tab-' + t));
    document.getElementById('sec-task').style.display = t === 'task' ? '' : 'none';
    document.getElementById('sec-playbook').style.display = t === 'playbook' ? '' : 'none';
    document.getElementById('sec-role').style.display = t === 'role' ? '' : 'none';
  }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  const moduleInput = document.getElementById('task-module');
  const taskOptions = document.getElementById('task-options');
  const taskDoc = document.getElementById('task-doc');

  function refreshOptionFields() {
    const mod = moduleInput.value.trim();
    vscode.postMessage({ type: 'options', module: mod });
  }

  moduleInput.addEventListener('change', refreshOptionFields);
  moduleInput.addEventListener('blur', refreshOptionFields);

  function addOption(key, value) {
    const row = document.createElement('div');
    row.className = 'opt';
    const k = document.createElement('input'); k.placeholder = 'option'; k.value = key || '';
    const v = document.createElement('input'); v.placeholder = 'value'; v.value = value || '';
    const btn = document.createElement('button'); btn.textContent = '×';
    btn.addEventListener('click', () => row.remove());
    row.appendChild(k); row.appendChild(v); row.appendChild(btn);
    taskOptions.appendChild(row);
  }
  document.getElementById('task-add-opt').addEventListener('click', () => addOption('', ''));

  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'options') {
      taskDoc.textContent = msg.doc || '';
      taskOptions.innerHTML = '';
      (msg.options || []).forEach(o => addOption(o, ''));
      if ((msg.options || []).length === 0) addOption('', '');
    }
  });

  function collectOptions() {
    const rows = [...taskOptions.querySelectorAll('.opt')];
    return rows.map(r => ({
      key: r.children[0].value,
      value: r.children[1].value
    })).filter(o => o.key.trim());
  }

  document.getElementById('task-generate').addEventListener('click', () => {
    vscode.postMessage({ type: 'task', name: document.getElementById('task-name').value, module: moduleInput.value.trim(), options: collectOptions() });
  });
  document.getElementById('pb-generate').addEventListener('click', () => {
    vscode.postMessage({ type: 'playbook', name: document.getElementById('pb-name').value, hosts: document.getElementById('pb-hosts').value, become: document.getElementById('pb-become').checked, gatherFacts: document.getElementById('pb-facts').checked, vault: document.getElementById('pb-vault').checked, roles: document.getElementById('pb-roles').value.split(',').map(s => s.trim()).filter(Boolean) });
  });
  document.getElementById('role-generate').addEventListener('click', () => {
    vscode.postMessage({ type: 'role', name: document.getElementById('role-name').value, includeTemplates: document.getElementById('role-tpl').checked, includeMeta: document.getElementById('role-meta').checked });
  });
  // restore state + render preview from extension
  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'preview') {
      const el = { task: 'task-preview', playbook: 'pb-preview', role: 'role-preview' }[msg.mode];
      if (el) document.getElementById(el).textContent = msg.yaml;
    }
  });
</script>
</body>
</html>`;
}

export class FormPanel {
  public static current: FormPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri) {
    this.panel = panel;
    this.panel.webview.html = renderHtml();
    this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg), undefined, []);
    panel.onDidDispose(() => (FormPanel.current = undefined));
  }

  public static createOrShow(extensionUri: vscode.Uri): void {
    if (FormPanel.current) {
      FormPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'ansibleForm',
      'Ansible Playbook Builder',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    FormPanel.current = new FormPanel(panel, extensionUri);
  }

  private onMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'options': {
        const mod = String(msg.module ?? '');
        const opts = listModuleOptions(mod);
        const doc = opts.length > 0 ? '' : 'No options catalogued for module "' + mod + '"';
        void this.panel.webview.postMessage({ type: 'options', options: opts, doc });
        break;
      }
      case 'task': {
        const yaml = generateTaskYaml({
          name: String(msg.name ?? ''),
          module: String(msg.module ?? ''),
          options: (msg.options as Array<{ key: string; value: string }>) ?? [],
          indent: 0,
        });
        this.insertIntoEditor(yaml);
        void this.panel.webview.postMessage({ type: 'preview', mode: 'task', yaml });
        break;
      }
      case 'playbook': {
        const yaml = generatePlaybookYaml({
          name: String(msg.name ?? ''),
          hosts: String(msg.hosts ?? 'all'),
          become: Boolean(msg.become),
          gatherFacts: Boolean(msg.gatherFacts),
          vault: Boolean(msg.vault),
          roles: (msg.roles as string[]) ?? [],
        });
        this.insertIntoEditor(yaml);
        void this.panel.webview.postMessage({ type: 'preview', mode: 'playbook', yaml });
        break;
      }
      case 'role': {
        const files = generateRoleFiles({
          name: String(msg.name ?? ''),
          includeTemplates: Boolean(msg.includeTemplates),
          includeMeta: Boolean(msg.includeMeta),
        });
        const summary = this.writeRoleFiles(files);
        void this.panel.webview.postMessage({ type: 'preview', mode: 'role', yaml: summary });
        break;
      }
    }
  }

  private insertIntoEditor(yaml: string): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage('Open a YAML file first.');
      return;
    }
    void editor.edit((eb) => {
      if (!editor.selection.isEmpty) {
        eb.replace(editor.selection, yaml);
      } else {
        eb.insert(editor.selection.active, yaml + '\n');
      }
    });
  }

  private writeRoleFiles(files: Array<{ path: string; content: string }>): string {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      void vscode.window.showWarningMessage('No folder is open.');
      return 'No folder open.';
    }
    const created: string[] = [];
    for (const f of files) {
      const abs = path.join(root, f.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      try {
        fs.writeFileSync(abs, f.content);
        created.push(f.path);
      } catch (err) {
        created.push(`FAILED: ${f.path} (${String(err)})`);
      }
    }
    void vscode.window.showInformationMessage(`Role files created: ${created.length}`);
    return 'Created:\n' + created.map((c) => `  ${c}`).join('\n');
  }
}
