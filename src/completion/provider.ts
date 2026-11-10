import * as vscode from 'vscode';
import { ANSIBLE_KEYWORDS, filterModules, moduleByName } from './modules';

/**
 * Completion provider for Ansible YAML:
 *  - module names under `tasks:` / `handlers:` / `pre_tasks:` / `post_tasks:`;
 *  - playbook keywords;
 *  - options of the current module inside a `- name:` block.
 */
export class AnsibleCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] {
    const line = document.lineAt(position.line);
    const textBefore = line.text.slice(0, position.character);
    const indent = line.text.length - line.text.trimStart().length;

    // Context: inside a task list, where the first key is the module name.
    const inTasksList = isUnderKey(document, position, /tasks|handlers|pre_tasks|post_tasks/);

    if (inTasksList && isListItem(document, position)) {
      return this.moduleCompletions(textBefore);
    }

    // After `- name:` complete the module options.
    const moduleName = this.detectModuleForTask(document, position);
    if (moduleName) {
      return this.optionCompletions(moduleName, indent);
    }

    // General keywords on the top level of the playbook.
    return ANSIBLE_KEYWORDS.map((k) => new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword));
  }

  private moduleCompletions(textBefore: string): vscode.CompletionItem[] {
    const trimmed = textBefore.trim();
    // Strip the leading `- `.
    const prefix = trimmed.replace(/^-\s*/, '');
    const items = filterModules(prefix);
    return items.map((m) => {
      const item = new vscode.CompletionItem(m.name, vscode.CompletionItemKind.Module);
      item.detail = m.doc;
      item.documentation = new vscode.MarkdownString(m.doc);
      item.insertText = new vscode.SnippetString(`${m.name}:\n\t${1}`);
      item.filterText = m.name;
      return item;
    });
  }

  private optionCompletions(moduleName: string, indent: number): vscode.CompletionItem[] {
    const mod = moduleByName(moduleName);
    if (!mod) return [];
    const pad = ' '.repeat(indent);
    return mod.options.map((opt) => {
      const item = new vscode.CompletionItem(opt, vscode.CompletionItemKind.Field);
      item.detail = `Option of module ${moduleName}`;
      item.insertText = pad + opt + ': $1';
      return item;
    });
  }

  /** Detect the module name of the current task (the first key in the list). */
  private detectModuleForTask(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): string | null {
    // Search upward for `- <module>:` (the first `- <something>:` after `- name:`).
    let nameSeen = false;
    for (let l = position.line - 1; l >= 0; l--) {
      const line = document.lineAt(l).text;
      const m = line.match(/^\s*-\s+name\s*:/);
      if (m) {
        nameSeen = true;
        continue;
      }
      if (nameSeen) {
        const mod = line.match(/^\s*-\s+([\w.]+)\s*:/);
        if (mod) return mod[1] ?? null;
        // Left the current task.
        break;
      }
      // An empty line or a new top level ends the search.
      if (line.trim() === '' && nameSeen) break;
    }
    return null;
  }
}

function isUnderKey(
  document: vscode.TextDocument,
  position: vscode.Position,
  keyRe: RegExp,
): boolean {
  for (let l = position.line; l >= 0; l--) {
    const line = document.lineAt(l).text;
    const m = line.match(/^\s*([\w]+)\s*:/);
    if (m) {
      if (keyRe.test(m[1] ?? '')) return true;
      if ((line.trimStart().length < document.lineAt(l).text.trimStart().length) || l < position.line - 30) {
        return false;
      }
    }
  }
  return false;
}

function isListItem(document: vscode.TextDocument, position: vscode.Position): boolean {
  const line = document.lineAt(position.line).text;
  // Either an unfinished `-` line, or after `- name:` we are on a new module line.
  if (/^\s*-\s*$/.test(line)) return true;
  const m = line.match(/^\s*-\s*(\S*)$/);
  return !!m;
}
