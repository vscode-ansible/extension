import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { moduleByName, ANSIBLE_MODULES } from '../completion/modules';
import { generateFromWizard } from '../form/generate';
import { parse, stringify } from 'yaml';
import { t } from '../i18n';
import { themeCss } from '../theme';
import { listVarFiles, readVars, writeVars } from '../vars/store';
import { encryptFile, decryptFile, viewFile } from '../secrets/vault';
import { initialWizardState } from './state';
import { listSelectablePlaybooks } from '../picker/playbooks';

interface UiPlaybook {
  name: string;
  hosts: string;
  become: boolean;
  gatherFacts: boolean;
}

interface UiTask {
  name: string;
  module: string;
  options: Array<{ key: string; value: string }>;
}

interface UiState {
  intent: 'playbook' | 'role' | 'task' | null;
  playbook: UiPlaybook;
  role: { name: string; includeTemplates: boolean; includeMeta: boolean };
  tasks: UiTask[];
  taskIndex: number;
  selectedPlaybook: string;
}

const DEFAULT_STATE: UiState = {
  intent: null,
  playbook: { name: '', hosts: 'all', become: false, gatherFacts: true },
  role: { name: '', includeTemplates: true, includeMeta: true },
  tasks: [],
  taskIndex: 0,
  selectedPlaybook: '',
};

function renderHtml(state: UiState): string {
  const modulesJson = JSON.stringify(ANSIBLE_MODULES.map((m) => m.name)).replace(/</g, '\\u003c');
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const playbooksJson = JSON.stringify(
    root ? listSelectablePlaybooks(root).map((p) => p.label) : [],
  ).replace(/</g, '\\u003c');
  const stateJson = JSON.stringify(state).replace(/</g, '\\u003c');

  const L: Record<string, string> = {
    title: t('wizard.title'),
    intentQuestion: t('wizard.intent.question'),
    playbook: t('wizard.intent.playbook'),
    role: t('wizard.intent.role'),
    task: t('wizard.intent.task'),
    playName: t('wizard.play.name'),
    hosts: t('wizard.play.hosts'),
    become: t('wizard.play.become'),
    gatherFacts: t('wizard.play.gatherFacts'),
    taskName: t('wizard.task.name'),
    module: t('wizard.task.module'),
    required: t('wizard.task.required'),
    optional: t('wizard.task.optional'),
    generate: t('common.generate'),
    done: t('common.done'),
    add: t('common.add'),
    save: t('common.save'),
    remove: t('common.remove'),
    vars: t('vars.title'),
    secrets: t('secrets.title'),
    roleName: t('wizard.role.name'),
    roleTemplates: t('wizard.role.templates'),
    roleMeta: t('wizard.role.meta'),
    loading: t('common.loading'),
    empty: t('common.empty'),
    warning: t('secrets.plainWarning'),
    selectPlaybook: t('graph.selectPlaybook'),
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
${themeCss()}
  * { box-sizing: border-box; }
  body { margin:0; background:var(--tk-bg); color:var(--tk-fg); font-family:var(--tk-font); font-size:var(--tk-font-size); display:flex; flex-direction:column; height:100vh; }
  header { padding:8px 12px; border-bottom:1px solid var(--tk-border); display:flex; align-items:center; gap:6px; }
  header h1 { font-size:12px; font-weight:600; margin:0; flex:1; }
  .tab { padding:3px 10px; background:transparent; border:1px solid var(--tk-border); color:var(--tk-fg); border-radius:2px; cursor:pointer; font-size:11px; font-family:inherit; }
  .tab.active { background:var(--tk-btn-bg); color:var(--tk-btn-fg); border-color:var(--tk-btn-bg); }
  main { flex:1; overflow-y:auto; padding:10px 12px; }
  .hint { font-size:11px; color:var(--tk-muted); padding:3px 0 8px; }
  .field { margin-bottom:9px; }
  .field label { display:block; margin-bottom:3px; color:var(--tk-muted); font-size:11px; }
  .field input, .field select { width:100%; background:var(--tk-input-bg); border:1px solid var(--tk-input-border); color:var(--tk-input-fg); padding:4px 6px; border-radius:2px; font-size:12px; font-family:inherit; }
  .field input:focus { outline:1px solid var(--tk-focus); outline-offset:-1px; }
  .seg { display:flex; gap:4px; margin-top:4px; }
  .seg button { flex:1; padding:5px 8px; background:var(--tk-btn-secondary-bg); color:var(--tk-btn-secondary-fg); border:1px solid var(--tk-border); border-radius:2px; cursor:pointer; font-size:12px; font-family:inherit; }
  .seg button.active { background:var(--tk-btn-bg); color:var(--tk-btn-fg); }
  .checks { display:flex; gap:14px; margin:6px 0; }
  .checks label { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--tk-fg); }
  .optrow { display:flex; gap:6px; margin-bottom:6px; align-items:center; }
  .optrow input { flex:1; }
  .optrow button { background:transparent; border:1px solid var(--tk-border); color:var(--tk-fg); border-radius:2px; cursor:pointer; width:24px; height:22px; flex-shrink:0; font-size:13px; }
  .req { color:var(--tk-error); }
  .actions { display:flex; gap:8px; margin-top:12px; }
  .actions button { padding:5px 14px; background:var(--tk-btn-bg); color:var(--tk-btn-fg); border:none; border-radius:2px; cursor:pointer; font-size:12px; font-family:inherit; }
  .actions button:hover { background:var(--tk-btn-hover); }
  .actions button.secondary { background:var(--tk-btn-secondary-bg); color:var(--tk-btn-secondary-fg); }
  .warning { color:var(--tk-error); font-size:11px; margin-top:3px; }
  textarea { width:100%; box-sizing:border-box; background:var(--tk-input-bg); border:1px solid var(--tk-input-border); color:var(--tk-input-fg); border-radius:2px; font-family:var(--tk-mono); font-size:11px; min-height:72px; max-height:60vh; padding:5px; resize:vertical; overflow:auto; display:block; }
  .filebox { margin-bottom:12px; padding:8px; border:1px solid var(--tk-border); border-radius:2px; }
  .filebox .name { font-size:12px; margin-bottom:6px; }
</style>
</head>
<body>
<header>
  <h1 id="title"></h1>
  <button class="tab" data-t="build"></button>
  <button class="tab" data-t="variables"></button>
  <button class="tab" data-t="secrets"></button>
</header>
<main>
  <div id="build"></div>
  <div id="variables" style="display:none"></div>
  <div id="secrets" style="display:none"></div>
</main>
<script>
  const vscode = acquireVsCodeApi();
  const MODULES = ${modulesJson};
  const PLAYBOOKS = ${playbooksJson};
  const L = ${JSON.stringify(L)};
  let S = ${stateJson};
  let tab = 'build';
  let moduleCache = {};

  const buildEl = () => document.getElementById('build');
  const varsEl = () => document.getElementById('variables');
  const secEl = () => document.getElementById('secrets');

  document.getElementById('title').textContent = L.title;
  document.querySelectorAll('.tab').forEach(b => {
    b.textContent = { build: L.title, variables: L.vars, secrets: L.secrets }[b.dataset.t];
    b.addEventListener('click', () => setTab(b.dataset.t));
  });

  function setTab(n) {
    tab = n;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.t === n));
    buildEl().style.display = n === 'build' ? '' : 'none';
    varsEl().style.display = n === 'variables' ? '' : 'none';
    secEl().style.display = n === 'secrets' ? '' : 'none';
    if (n === 'build') renderBuild();
    if (n === 'variables') { varsEl().innerHTML = ''; vscode.postMessage({ type: 'vars:list' }); }
    if (n === 'secrets') { secEl().innerHTML = ''; vscode.postMessage({ type: 'secrets:list' }); }
  }

  function field(label, input, req) {
    const d = document.createElement('div'); d.className = 'field';
    const l = document.createElement('label');
    l.textContent = label + (req ? ' ' : '');
    if (req) { const r = document.createElement('span'); r.className = 'req'; r.textContent = '*'; l.appendChild(r); }
    d.appendChild(l); d.appendChild(input);
    return d;
  }

  function hint(text) { const h = document.createElement('div'); h.className = 'hint'; h.textContent = text; return h; }

  function renderBuild() {
    const el = buildEl(); el.innerHTML = '';

    if (!S.intent) {
      el.appendChild(hint(L.intentQuestion));
      const seg = document.createElement('div'); seg.className = 'seg';
      [['playbook', L.playbook], ['role', L.role], ['task', L.task]].forEach(([k, label]) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.addEventListener('click', () => { S.intent = k; if (k === 'task' && S.tasks.length === 0) S.tasks.push({ name: '', module: '', options: [] }); renderBuild(); });
        seg.appendChild(b);
      });
      el.appendChild(seg);
      return;
    }

    if (S.intent === 'playbook') renderPlaybook(el);
    else if (S.intent === 'role') renderRole(el);
    else renderSingleTask(el);
  }

  function renderPlaybook(el) {
    el.appendChild(hint(L.playbook));
    const p = S.playbook;
    // Existing playbook dropdown (fills the play name when chosen).
    if (PLAYBOOKS.length > 0) {
      const sel = document.createElement('select');
      const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = L.selectPlaybook + '…';
      sel.appendChild(opt0);
      PLAYBOOKS.forEach(label => {
        const o = document.createElement('option'); o.value = label; o.textContent = label;
        if (S.selectedPlaybook === label) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => {
        S.selectedPlaybook = sel.value;
        if (sel.value) p.name = sel.value.replace(/\\.ya?ml$/i, '');
      });
      el.appendChild(field(L.selectPlaybook, sel));
    }
    const name = document.createElement('input'); name.value = p.name; name.placeholder = L.playName;
    name.addEventListener('input', () => p.name = name.value);
    el.appendChild(field(L.playName, name));
    const hosts = document.createElement('input'); hosts.value = p.hosts; hosts.placeholder = L.hosts;
    hosts.addEventListener('input', () => p.hosts = hosts.value);
    el.appendChild(field(L.hosts, hosts));
    const chk = document.createElement('div'); chk.className = 'checks';
    ['become', 'gatherFacts'].forEach(k => {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = p[k];
      cb.addEventListener('change', () => p[k] = cb.checked);
      const lbl = document.createElement('label'); lbl.appendChild(cb); lbl.appendChild(document.createTextNode(L[k])); chk.appendChild(lbl);
    });
    el.appendChild(chk);

    S.tasks.forEach((task, i) => {
      const box = document.createElement('div');
      renderTaskEditor(box, task, i, S);
      el.appendChild(box);
    });

    const add = document.createElement('button'); add.className = 'tab'; add.textContent = '+ ' + L.task;
    add.addEventListener('click', () => { S.tasks.push({ name: '', module: '', options: [] }); renderBuild(); });
    el.appendChild(add);
    renderActions(el, S, null);
  }

  function renderRole(el) {
    el.appendChild(hint(L.role));
    const r = S.role;
    const name = document.createElement('input'); name.value = r.name; name.placeholder = L.roleName;
    name.addEventListener('input', () => r.name = name.value);
    el.appendChild(field(L.roleName, name));
    const chk = document.createElement('div'); chk.className = 'checks';
    ['includeTemplates', 'includeMeta'].forEach(k => {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = r[k];
      cb.addEventListener('change', () => r[k] = cb.checked);
      const lbl = document.createElement('label'); lbl.appendChild(cb); lbl.appendChild(document.createTextNode(L[k === 'includeTemplates' ? 'roleTemplates' : 'roleMeta'])); chk.appendChild(lbl);
    });
    el.appendChild(chk);
    renderActions(el, S, null);
  }

  function renderSingleTask(el) {
    el.appendChild(hint(L.task));
    const task = S.tasks[0] || { name: '', module: '', options: [] };
    if (S.tasks.length === 0) S.tasks.push(task);
    renderTaskEditor(el, task, 0, S);
    renderActions(el, S, task);
  }

  function renderTaskEditor(box, task, i, S) {
    const modKey = task.module;
    if (!moduleCache[modKey]) moduleCache[modKey] = { required: [], optional: [] };
    const info = moduleCache[modKey] || { required: [], optional: [] };

    const name = document.createElement('input'); name.value = task.name; name.placeholder = L.taskName;
    name.addEventListener('input', () => task.name = name.value);
    box.appendChild(field(L.taskName, name));

    const md = document.createElement('input'); md.value = task.module; md.placeholder = L.module; md.setAttribute('list', 'mods-' + i);
    md.addEventListener('change', () => { task.module = md.value.trim(); vscode.postMessage({ type: 'module-info', module: task.module }); renderTaskEditor(box, task, i, S); });
    box.appendChild(field(L.module, md));
    const dl = document.createElement('datalist'); dl.id = 'mods-' + i;
    MODULES.forEach(m => { const o = document.createElement('option'); o.value = m; dl.appendChild(o); });
    box.appendChild(dl);

    // required options as text inputs (pre-seeded keys)
    info.required.forEach(req => {
      let opt = task.options.find(o => o.key === req);
      if (!opt) { opt = { key: req, value: '' }; task.options.push(opt); }
      const inp = document.createElement('input'); inp.value = opt.value; inp.placeholder = req;
      inp.addEventListener('input', () => opt.value = inp.value);
      box.appendChild(field(req, inp, true));
    });
    // optional options: free-form key/value rows
    const optLabel = document.createElement('div'); optLabel.className = 'hint'; optLabel.textContent = L.optional;
    box.appendChild(optLabel);
    const optionalRows = task.options.filter(o => !info.required.includes(o.key));
    optionalRows.forEach((opt, j) => {
      const row = document.createElement('div'); row.className = 'optrow';
      const k = document.createElement('input'); k.value = opt.key; k.placeholder = 'key'; k.addEventListener('input', () => opt.key = k.value);
      const v = document.createElement('input'); v.value = opt.value; v.placeholder = 'value'; v.addEventListener('input', () => opt.value = v.value);
      const x = document.createElement('button'); x.textContent = '×';
      x.addEventListener('click', () => { task.options = task.options.filter(o => o !== opt); renderTaskEditor(box, task, i, S); });
      row.appendChild(k); row.appendChild(v); row.appendChild(x); box.appendChild(row);
    });
    const addOpt = document.createElement('button'); addOpt.className = 'tab'; addOpt.textContent = '+ ' + L.optional;
    addOpt.addEventListener('click', () => { task.options.push({ key: '', value: '' }); renderTaskEditor(box, task, i, S); });
    box.appendChild(addOpt);
  }

  function renderActions(el, S, singleTask) {
    const a = document.createElement('div'); a.className = 'actions';
    const gen = document.createElement('button');
    gen.textContent = L.generate;
    gen.addEventListener('click', () => vscode.postMessage({ type: 'generate', state: S }));
    a.appendChild(gen);
    el.appendChild(a);
  }

  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'module-info') {
      moduleCache[msg.module] = { required: msg.required || [], optional: msg.optional || [] };
      if (tab === 'build') renderBuild();
    }
    if (msg.type === 'vars:list') {
      const el = varsEl(); el.innerHTML = '';
      if (!msg.files || msg.files.length === 0) { el.appendChild(hint(L.empty)); return; }
      msg.files.forEach(f => {
        const box = document.createElement('div'); box.className = 'filebox';
        const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = f.name + ' (' + f.target + ')'; box.appendChild(nm);
        if (f.vault) { const m = document.createElement('div'); m.className = 'hint'; m.textContent = '[encrypted]'; box.appendChild(m); }
        else {
          const ta = document.createElement('textarea'); ta.value = f.content || ''; box.appendChild(ta);
          const row = document.createElement('div'); row.className = 'actions';
          const sv = document.createElement('button'); sv.textContent = L.save;
          sv.addEventListener('click', () => vscode.postMessage({ type: 'vars:save', path: f.fsPath, content: ta.value }));
          row.appendChild(sv); box.appendChild(row);
          // Debounced autosave on editing.
          let timer = null;
          ta.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => vscode.postMessage({ type: 'vars:save', path: f.fsPath, content: ta.value, silent: true }), 800);
          });
        }
        el.appendChild(box);
      });
    }
    if (msg.type === 'secrets:list') {
      const el = secEl(); el.innerHTML = '';
      if (!msg.files || msg.files.length === 0) { el.appendChild(hint(L.empty)); return; }
      msg.files.forEach(f => {
        const box = document.createElement('div'); box.className = 'filebox';
        const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = f.name; box.appendChild(nm);
        const row = document.createElement('div'); row.className = 'actions';
        [['encrypt', t_secret('encrypt')], ['decrypt', t_secret('decrypt')], ['view', t_secret('view')]].forEach(([a, label]) => {
          const b = document.createElement('button'); b.className = 'secondary'; b.textContent = label;
          b.addEventListener('click', () => vscode.postMessage({ type: 'secrets:' + a, path: f.fsPath }));
          row.appendChild(b);
        });
        box.appendChild(row); el.appendChild(box);
      });
    }
  });

  function t_secret(a) { const m = { encrypt: L.encrypt, decrypt: L.decrypt, view: L.view }; return m[a] || a; }

  setTab('build');
</script>
</body>
</html>`;
}

export class WizardPanel {
  public static current: WizardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    panel.onDidDispose(() => (WizardPanel.current = undefined));
    panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg), undefined, []);
  }

  public static createOrShow(_extensionUri: vscode.Uri): void {
    if (WizardPanel.current) {
      WizardPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'ansibleWizard',
      t('wizard.title'),
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    WizardPanel.current = new WizardPanel(panel);
    panel.webview.html = renderHtml(DEFAULT_STATE);
  }

  /** Re-renders the panel (e.g. after a language change). */
  public static rebuild(): void {
    if (WizardPanel.current) {
      WizardPanel.current.panel.title = t('wizard.title');
      WizardPanel.current.panel.webview.html = renderHtml(DEFAULT_STATE);
    }
  }

  private onMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'module-info': {
        const mod = moduleByName(String(msg.module ?? ''));
        void this.panel.webview.postMessage({
          type: 'module-info',
          module: msg.module,
          required: mod ? mod.required : [],
          optional: mod ? mod.optional : [],
        });
        break;
      }
      case 'generate': {
        const state = msg.state as UiState;
        this.handleGenerate(state);
        break;
      }
      case 'vars:list': {
        this.handleVarsList();
        break;
      }
      case 'vars:save': {
        this.handleVarsSave(String(msg.path ?? ''), String(msg.content ?? ''), msg.silent === true);
        break;
      }
      case 'secrets:list': {
        this.handleSecretsList();
        break;
      }
      case 'secrets:encrypt':
      case 'secrets:decrypt':
      case 'secrets:view': {
        void this.runVault(String(msg.type).replace('secrets:', ''), String(msg.path ?? ''));
        break;
      }
    }
  }

  private handleGenerate(state: UiState): void {
    const wizardState = initialWizardState();
    const out =
      state.intent === 'role'
        ? generateFromWizard({
            ...wizardState,
            intent: 'role',
            role: {
              name: state.role.name,
              includeTemplates: state.role.includeTemplates,
              includeMeta: state.role.includeMeta,
            },
          })
        : generateFromWizard({
            ...wizardState,
            intent: state.intent ?? 'task',
            play: {
              name: state.playbook.name,
              hosts: state.playbook.hosts,
              become: state.playbook.become,
              gatherFacts: state.playbook.gatherFacts,
              roles: [],
            },
            tasks: state.tasks.map((t) => ({
              name: t.name,
              module: t.module,
              options: t.options.filter((o) => o.key.trim()),
            })),
          });

    if (out.files.length > 0) this.writeFiles(out.files);
    else if (out.yaml.trim()) this.insertIntoEditor(out.yaml);
  }

  private handleVarsList(): void {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { void this.panel.webview.postMessage({ type: 'vars:list', files: [] }); return; }
    const files = listVarFiles(root).map((f) => {
      const v = readVars(f.fsPath);
      const isVault = (v as Record<string, unknown>).__vault === true;
      let content = '';
      if (isVault) content = '';
      else {
        const { __vault, ...rest } = v as Record<string, unknown>;
        void __vault;
        try { content = stringifyVars(rest); } catch { content = ''; }
      }
      return { fsPath: f.fsPath, name: f.name, target: f.target, vault: isVault, content };
    });
    void this.panel.webview.postMessage({ type: 'vars:list', files });
  }

  private handleVarsSave(filePath: string, content: string, silent = false): void {
    try {
      const doc = parse(content);
      if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
        writeVars(filePath, doc as Record<string, unknown>);
        if (!silent) void vscode.window.showInformationMessage(t('vars.title') + ': ' + t('common.done').toLowerCase());
      } else if (!silent) {
        void vscode.window.showWarningMessage('Not a valid YAML mapping.');
      }
    } catch (err) {
      if (!silent) void vscode.window.showWarningMessage(String(err));
    }
  }

  private handleSecretsList(): void {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { void this.panel.webview.postMessage({ type: 'secrets:list', files: [] }); return; }
    const files = listVarFiles(root).map((f) => ({ fsPath: f.fsPath, name: f.name }));
    void this.panel.webview.postMessage({ type: 'secrets:list', files });
  }

  private async runVault(action: string, filePath: string): Promise<void> {
    const res =
      action === 'encrypt'
        ? await encryptFile(filePath)
        : action === 'decrypt'
          ? await decryptFile(filePath)
          : await viewFile(filePath);

    if (res.code !== 0) {
      const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
      const out = res.output.replace(ansi, '');
      const msg =
        /decryption failed|incorrect vault password|wrong vault password/i.test(out)
          ? 'Wrong vault password. Try again.'
          : /no vault secrets|could not find vault/i.test(out)
            ? 'No vault password source found. Create a vault first.'
            : 'ansible-vault error: ' + out.trim().split('\n').pop()?.slice(0, 160);
      void vscode.window.showErrorMessage(msg);
      return;
    }
    if (action === 'view') {
      const channel = vscode.window.createOutputChannel('ansible-vault view');
      channel.clear();
      channel.append(res.output);
      channel.show();
    } else {
      void vscode.window.showInformationMessage('ansible-vault ' + action + ' ok');
    }
  }

  private insertIntoEditor(yaml: string): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage(t('playbook.openFirst'));
      return;
    }
    void editor.edit((eb) => {
      if (!editor.selection.isEmpty) eb.replace(editor.selection, yaml);
      else eb.insert(editor.selection.active, yaml);
    });
  }

  private writeFiles(files: Array<{ path: string; content: string }>): void {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      void vscode.window.showInformationMessage(t('playbook.noFolder'));
      return;
    }
    for (const f of files) {
      const abs = path.join(root, f.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      try {
        fs.writeFileSync(abs, f.content);
      } catch (err) {
        void vscode.window.showWarningMessage(`Failed ${f.path}: ${String(err)}`);
      }
    }
    void vscode.window.showInformationMessage(`${files.length} file(s) created.`);
  }
}

function stringifyVars(vars: Record<string, unknown>): string {
  return stringify(vars, { indent: 2 });
}
