import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

type TreeNode =
  | { type: 'section'; id: string; label: string }
  | { type: 'playbook'; id: string; label: string; fsPath: string }
  | { type: 'role'; id: string; label: string; fsPath: string }
  | { type: 'inventory'; id: string; label: string; fsPath: string };

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

export class AnsibleTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh());
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.type === 'section') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = 'section';
      return item;
    }
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [vscode.Uri.file(element.fsPath)],
    };
    item.tooltip = element.fsPath;
    switch (element.type) {
      case 'playbook':
        item.iconPath = new vscode.ThemeIcon('run');
        item.contextValue = 'playbook';
        break;
      case 'role':
        item.iconPath = new vscode.ThemeIcon('folder-library');
        item.contextValue = 'role';
        break;
      case 'inventory':
        item.iconPath = new vscode.ThemeIcon('server');
        item.contextValue = 'inventory';
        break;
    }
    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return [];

    if (!element) {
      return [
        { type: 'section', id: 'playbooks', label: 'Playbooks' },
        { type: 'section', id: 'roles', label: 'Roles' },
        { type: 'section', id: 'inventory', label: 'Inventory' },
      ];
    }

    if (element.type === 'section') {
      switch (element.id) {
        case 'playbooks':
          return listPlaybooks(root).map((f) => ({
            type: 'playbook',
            id: `pb:${f}`,
            label: f,
            fsPath: path.join(root, f),
          }));
        case 'roles':
          return listDirNames(path.join(root, 'roles')).map((r) => ({
            type: 'role',
            id: `role:${r}`,
            label: r,
            fsPath: path.join(root, 'roles', r),
          }));
        case 'inventory':
          return listInventory(root).map((f) => ({
            type: 'inventory',
            id: `inv:${f}`,
            label: f,
            fsPath: path.join(root, f),
          }));
      }
    }

    return [];
  }
}

function listPlaybooks(root: string): string[] {
  try {
    return fs
      .readdirSync(root)
      .filter((f) => /\.ya?ml$/i.test(f) && !/requirements\.ya?ml/i.test(f) && !/run-queue\.ya?ml/i.test(f))
      .sort();
  } catch {
    return [];
  }
}

function listInventory(root: string): string[] {
  const candidates = [];
  for (const d of ['inventory', 'inventories']) {
    const full = path.join(root, d);
    try {
      if (fs.statSync(full).isDirectory()) {
        for (const f of fs.readdirSync(full)) {
          if (f.includes('hosts') || /\.ini$/i.test(f) || /\.ya?ml$/i.test(f)) candidates.push(path.join(d, f));
        }
      }
    } catch {
      /* skip */
    }
  }
  return candidates.sort();
}
