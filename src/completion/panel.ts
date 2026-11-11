import * as vscode from 'vscode';
import { ANSIBLE_MODULES, ANSIBLE_KEYWORDS } from './modules';
import { themeCss } from '../theme';

function renderModulesHtml(): string {
  const modules = ANSIBLE_MODULES;
  const keywords = ANSIBLE_KEYWORDS;

  const modulesJson = JSON.stringify(modules).replace(/</g, '\\u003c');
  const keywordsJson = JSON.stringify(keywords).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
${themeCss()}
  :root {
    --bg: var(--tk-bg);
    --panel: var(--tk-bg);
    --border: var(--tk-border);
    --text: var(--tk-fg);
    --muted: var(--tk-muted);
    --accent: var(--tk-accent);
    --accent-soft: var(--vscode-list-inactiveSelectionBackground, var(--tk-input-bg));
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--tk-font);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
  header {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }
  header .title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  header .title span { color: var(--muted); font-weight: 400; }
  #search {
    width: 100%;
    padding: 6px 10px;
    background: var(--tk-input-bg);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--tk-input-fg);
    font-size: 12px;
    outline: none;
  }
  #search:focus { border-color: var(--tk-focus); }
  main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  #list {
    width: 220px;
    overflow-y: auto;
    border-right: 1px solid var(--border);
    padding: 4px 0;
  }
  #list .item {
    padding: 7px 12px;
    cursor: pointer;
    font-size: 12px;
    font-family: var(--tk-mono);
    color: var(--text);
  }
  #list .item:hover { background: var(--accent-soft); }
  #list .item.active { background: var(--accent-soft); border-left: 2px solid var(--accent); }
  #list .item .kw { color: var(--accent); }
  #detail {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }
  #detail h2 {
    margin: 0 0 4px;
    font-size: 18px;
    font-family: var(--tk-mono);
    color: var(--accent);
  }
  #detail .doc { color: var(--text); font-size: 13px; margin: 4px 0 16px; }
  #detail h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin: 0 0 8px;
  }
  #detail ul { list-style: none; padding: 0; margin: 0; }
  #detail li {
    font-family: var(--tk-mono);
    font-size: 12px;
    padding: 5px 8px;
    border: 1px solid var(--border);
    border-radius: 2px;
    margin-bottom: 6px;
    background: var(--panel);
  }
  #detail li.req { border-left: 2px solid var(--tk-accent); }
  .empty { color: var(--muted); padding: 20px; font-size: 12px; }
</style>
</head>
<body>
<header>
  <div class="title">Ansible modules <span id="count"></span></div>
  <input id="search" type="text" placeholder="Search modules…" />
</header>
<main>
  <nav id="list"></nav>
  <section id="detail"></section>
</main>
<script>
  const modules = ${modulesJson};
  const keywords = ${keywordsJson};

  const listEl = document.getElementById('list');
  const detailEl = document.getElementById('detail');
  const searchEl = document.getElementById('search');
  const countEl = document.getElementById('count');

  let selected = null;

  function renderList(filter) {
    const f = (filter || '').toLowerCase();
    const items = modules.filter((m) =>
      !f || m.name.toLowerCase().includes(f) || (m.doc || '').toLowerCase().includes(f)
    );
    countEl.textContent = '(' + items.length + '/' + modules.length + ')';
    listEl.innerHTML = '';

    const kwSection = document.createElement('div');
    kwSection.className = 'item';
    kwSection.innerHTML = '<span class="kw">Playbook keywords</span> (' + keywords.length + ')';
    kwSection.addEventListener('click', () => renderDetail(null));
    listEl.appendChild(kwSection);

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No matching modules';
      listEl.appendChild(empty);
    }

    for (const m of items) {
      const el = document.createElement('div');
      el.className = 'item';
      el.textContent = m.name;
      el.addEventListener('click', () => {
        document.querySelectorAll('#list .item').forEach((n) => n.classList.remove('active'));
        el.classList.add('active');
        renderDetail(m);
      });
      listEl.appendChild(el);
    }
  }

  function renderDetail(entry) {
    if (entry === null) {
      detailEl.innerHTML = '<h2>Playbook keywords</h2>' +
        '<ul>' + keywords.map((k) => '<li>' + k + '</li>').join('') + '</ul>';
      return;
    }
    if (!entry) {
      detailEl.innerHTML = '<div class="empty">Select a module to view its options.</div>';
      return;
    }
    const required = entry.required && entry.required.length
      ? '<h3>Required</h3><ul>' + entry.required.map((o) => '<li class="req">' + o + '</li>').join('') + '</ul>'
      : '';
    const optional = entry.optional && entry.optional.length
      ? '<h3>Optional</h3><ul>' + entry.optional.map((o) => '<li>' + o + '</li>').join('') + '</ul>'
      : '';
    const hasOptions = (entry.required?.length || 0) + (entry.optional?.length || 0) > 0;
    detailEl.innerHTML =
      '<h2>' + entry.name + '</h2>' +
      '<div class="doc">' + (entry.doc || '') + '</div>' +
      (hasOptions ? required + optional : '<div class="empty">No options catalogued.</div>');
  }

  searchEl.addEventListener('input', () => renderList(searchEl.value));
  renderList('');
  renderDetail(null);
</script>
</body>
</html>`;
}

export class ModulesPanel {
  public static current: ModulesPanel | undefined;

  private readonly panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.refresh();
  }

  public static createOrShow(extensionUri: vscode.Uri): void {
    if (ModulesPanel.current) {
      ModulesPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'ansibleModules',
      'Ansible modules',
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'icon.png');
    ModulesPanel.current = new ModulesPanel(panel);
    panel.onDidDispose(() => (ModulesPanel.current = undefined));
  }

  private refresh(): void {
    this.panel.webview.html = renderModulesHtml();
  }
}
