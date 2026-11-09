import * as vscode from 'vscode';
import { findSecretLeaks } from './pure';
import { SECRET_PATTERNS } from './types';

interface FileLeak {
  message: string;
  line: number;
  start: number;
  end: number;
}

/** Прогоняет сканер секретов по файлу и обновляет диагностику. */
export function scanDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
  const text = document.getText();
  if (SECRET_PATTERNS.ansibleVaultHeader.test(text)) return [];
  const leaks: FileLeak[] = findSecretLeaks(text);
  const diagnostics: vscode.Diagnostic[] = [];
  for (const leak of leaks) {
    const line = document.lineAt(Math.min(leak.line, document.lineCount - 1));
    const range = new vscode.Range(
      new vscode.Position(leak.line, Math.min(leak.start, line.text.length)),
      new vscode.Position(leak.line, Math.min(leak.end, line.text.length)),
    );
    const d = new vscode.Diagnostic(
      range,
      leak.message,
      vscode.DiagnosticSeverity.Warning,
    );
    d.source = 'Ansible Toolkit (секреты)';
    diagnostics.push(d);
  }
  return diagnostics;
}

const SECRET_DIAGNOSTIC_SOURCE = 'Ansible Toolkit (секреты)';

/** Провайдер CodeAction: предлагает «обернуть в ansible-vault» / «заменить шаблоном». */
export class SecretCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] {
    const text = document.lineAt(range.start.line).text;
    if (!/password|secret|token|api[_-]?key|AKIA/i.test(text)) return [];

    const fixVault = new vscode.CodeAction(
      'Заменить на шаблон ansible-vault ({{ vault_... }})',
      vscode.CodeActionKind.QuickFix,
    );
    fixVault.edit = new vscode.WorkspaceEdit();
    const key = text.match(/^\s*[\w-]+\s*:/)?.[0].replace(/:$/, '').trim() ?? 'secret';
    fixVault.edit.replace(
      document.uri,
      new vscode.Range(range.start.line, 0, range.start.line, text.length),
      `${text.slice(0, range.start.character)}` +
        text.replace(/(['"]).*?\1/, (m) => `{{ vault_${key} }}`),
    );
    fixVault.diagnostics = [
      new vscode.Diagnostic(
        new vscode.Range(range.start.line, 0, range.start.line, text.length),
        '',
        vscode.DiagnosticSeverity.Hint,
      ),
    ];

    return [fixVault];
  }
}

export { SECRET_DIAGNOSTIC_SOURCE };
