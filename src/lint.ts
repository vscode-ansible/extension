import * as vscode from 'vscode';
import { runLint } from './runner';

interface LintFinding {
  severity: 'error' | 'warning';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  rule?: string;
}

/**
 * Парсит вывод `ansible-lint` (формат по умолчанию и strict) в диагностику VS Code.
 * Пример строки: `playbook.yml:12: [E208] File permissions unset or incorrect`.
 */
function parseLintOutput(output: string): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const raw of output.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([^:\s]+\.(?:yml|yaml)):(\d+)(?::(\d+))?:\s*(?:\[([A-Z]+\d+)\]\s*)?(.*)$/);
    if (m) {
      findings.push({
        file: m[1],
        line: parseInt(m[2] ?? '0', 10) - 1,
        column: m[3] ? parseInt(m[3], 10) : undefined,
        rule: m[4],
        severity: (m[4] ?? '').startsWith('E') ? 'error' : 'warning',
        message: (m[5] ?? '').trim() || m[4] || 'lint error',
      });
      continue;
    }
    // Fallback: общая строка ошибки.
    const warn = line.match(/^\[(WARNING|ERROR)\]\s*(.*)$/i);
    if (warn) {
      findings.push({
        severity: warn[1]?.toLowerCase() === 'error' ? 'error' : 'warning',
        message: warn[2] ?? '',
      });
    }
  }
  return findings;
}

export function lintToDiagnostics(
  output: string,
  document: vscode.TextDocument,
): vscode.Diagnostic[] {
  const findings = parseLintOutput(output);
  const diagnostics: vscode.Diagnostic[] = [];
  for (const f of findings) {
    const line = Math.max(0, Math.min((f.line ?? 0), document.lineCount - 1));
    const col = Math.max(0, f.column ?? 0);
    const range = new vscode.Range(
      new vscode.Position(line, col),
      new vscode.Position(line, Math.max(col, document.lineAt(line).text.length)),
    );
    const d = new vscode.Diagnostic(
      range,
      f.message,
      f.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
    );
    d.source = `ansible-lint${f.rule ? ` ${f.rule}` : ''}`;
    d.code = f.rule;
    diagnostics.push(d);
  }
  return diagnostics;
}

/** Запускает ansible-lint на активном документе и обновляет диагностику. */
export async function lintActiveDocument(document: vscode.TextDocument): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('ansibleToolkit');
  if (!cfg.get<boolean>('lint.enabled', true)) return;

  const root = vscode.workspace.workspaceFolders?.[0];
  const cwd = root?.uri.fsPath;
  if (!cwd) return;

  const res = await runLint(cwd);
  const collection = vscode.languages.createDiagnosticCollection('ansible-lint');
  collection.set(document.uri, lintToDiagnostics(res.output, document));
}
