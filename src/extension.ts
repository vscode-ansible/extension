import * as vscode from 'vscode';
import { AnsibleCompletionProvider } from './completion/provider';
import { scanDocument, SecretCodeActionProvider, SECRET_DIAGNOSTIC_SOURCE } from './secrets/diagnostics';
import { lintActiveDocument } from './lint';
import {
  runPlaybookInTerminal,
  listTasks,
  runSequential,
} from './runner';
import type { RunStep } from './runner';
import { parseTaskNames } from './debug/pure';
import { findFirstExisting, parseQueueFile, listPlaybookFiles, isPlaybookFile } from './queue';
import * as path from 'node:path';
import {
  GraphPanel,
} from './graph/panel';
import { ModulesPanel } from './completion/panel';
import { AnsibleTreeProvider } from './tree/panel';
import { StepsPanel } from './steps/panel';
import { WizardPanel } from './wizard/panel';
import { setLanguage } from './i18n';

const ANSIBLE_IDS = ['ansible', 'yaml'];

export function activate(context: vscode.ExtensionContext): void {
  // Initialize the i18n language from settings (auto → env language).
  const langCfg = vscode.workspace.getConfiguration('ansibleToolkit').get<string>('language') ?? 'auto';
  setLanguage(langCfg === 'auto' ? vscode.env.language : langCfg);

  // Re-apply language when the user changes the setting. Webview colors follow
  // the theme live (CSS variables), so only text needs a rebuild.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ansibleToolkit.language')) {
        const cfg = vscode.workspace.getConfiguration('ansibleToolkit').get<string>('language') ?? 'auto';
        setLanguage(cfg === 'auto' ? vscode.env.language : cfg);
        WizardPanel.rebuild();
      }
    }),
  );

  const token = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) void lintActiveDocument(editor.document);
  });
  context.subscriptions.push(token);

  const secretsCollection =
    vscode.languages.createDiagnosticCollection(SECRET_DIAGNOSTIC_SOURCE);
  context.subscriptions.push(secretsCollection);

  // completion
  const completion = vscode.languages.registerCompletionItemProvider(
    ANSIBLE_IDS,
    new AnsibleCompletionProvider(),
  );
  context.subscriptions.push(completion);

  // code actions for secrets
  const codeAction = vscode.languages.registerCodeActionsProvider(
    ANSIBLE_IDS,
    new SecretCodeActionProvider(),
  );
  context.subscriptions.push(codeAction);

  // scan secrets on open/save for ansible/yaml
  const secretWatch = vscode.workspace.onDidSaveTextDocument((doc) =>
    scanSecrets(doc, secretsCollection),
  );
  context.subscriptions.push(secretWatch);
  for (const doc of vscode.workspace.textDocuments) {
    if (ANSIBLE_IDS.includes(doc.languageId)) scanSecrets(doc, secretsCollection);
  }

  // lint on save
  const lintWatch = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (ANSIBLE_IDS.includes(doc.languageId) && isLintOnSave()) {
      void lintActiveDocument(doc);
    }
  });
  context.subscriptions.push(lintWatch);

  // commands
  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.runPlaybook', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showInformationMessage('Open a playbook before running.');
        return;
      }
      const filePath = editor.document.uri.fsPath;
      if (!isPlaybookFile(filePath)) {
        void vscode.window.showWarningMessage(
          `${path.basename(filePath)} is not a playbook (it has no list of plays with \`hosts\`).`,
        );
        return;
      }
      runPlaybookInTerminal(filePath);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.runLint', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      await lintActiveDocument(editor.document);
      void vscode.window.showInformationMessage('ansible-lint completed.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.showGraph', async () => {
      const root = vscode.workspace.workspaceFolders?.[0];
      if (!root) {
        void vscode.window.showWarningMessage('No folder is open.');
        return;
      }
      GraphPanel.createOrShow(context.extensionUri, root.uri.fsPath);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.listTasks', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      if (!isPlaybookFile(editor.document.uri.fsPath)) {
        void vscode.window.showWarningMessage(
          `${path.basename(editor.document.uri.fsPath)} is not a playbook.`,
        );
        return;
      }
      const output = await listTasks(editor.document.uri.fsPath);
      const names = parseTaskNames(output);
      if (names.length === 0) {
        void vscode.window.showInformationMessage('No tasks found.');
        return;
      }
      const picked = await vscode.window.showQuickPick(names, {
        placeHolder: 'Select a task (preview)',
      });
      if (picked) {
        void vscode.window.showInformationMessage(`Task: ${picked}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.runFromTask', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      if (!isPlaybookFile(editor.document.uri.fsPath)) {
        void vscode.window.showWarningMessage(
          `${path.basename(editor.document.uri.fsPath)} is not a playbook.`,
        );
        return;
      }
      const output = await listTasks(editor.document.uri.fsPath);
      const names = parseTaskNames(output);
      if (names.length === 0) {
        void vscode.window.showInformationMessage('No tasks found.');
        return;
      }
      const picked = await vscode.window.showQuickPick(names, {
        placeHolder: 'Run from task',
      });
      if (picked) {
        runPlaybookInTerminal(editor.document.uri.fsPath, ['--start-at-task', `"${picked}"`]);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.detectSecrets', async () => {
      const root = vscode.workspace.workspaceFolders?.[0];
      if (!root) return;
      let count = 0;
      for (const doc of vscode.workspace.textDocuments) {
        if (!ANSIBLE_IDS.includes(doc.languageId)) continue;
        const diags = scanSecrets(doc, secretsCollection);
        count += diags;
      }
      void vscode.window.showInformationMessage(
        `Potential secrets found: ${count}`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.runQueue', async () => {
      await runQueue();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.showModules', () => {
      ModulesPanel.createOrShow(context.extensionUri);
    }),
  );

  // Activity Bar tree view (always visible when a folder is open).
  const treeProvider = new AnsibleTreeProvider();
  context.subscriptions.push(
    vscode.window.createTreeView('ansibleToolkit.explorer', {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.refreshExplorer', () => {
      treeProvider.refresh();
    }),
  );

  // Playbook constructor (wizard). The legacy openForm command now opens it too.
  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.openWizard', () => {
      WizardPanel.createOrShow(context.extensionUri);
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.openForm', () => {
      WizardPanel.createOrShow(context.extensionUri);
    }),
  );

  // Step-by-step runner for the active playbook.
  context.subscriptions.push(
    vscode.commands.registerCommand('ansibleToolkit.openSteps', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      if (!isPlaybookFile(editor.document.uri.fsPath)) {
        void vscode.window.showWarningMessage(
          `${path.basename(editor.document.uri.fsPath)} is not a playbook — open a playbook first.`,
        );
        return;
      }
      await StepsPanel.createOrShow(editor.document.uri.fsPath);
    }),
  );
}

function scanSecrets(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
): number {
  if (!ANSIBLE_IDS.includes(doc.languageId)) return 0;
  const cfg = vscode.workspace.getConfiguration('ansibleToolkit');
  if (!cfg.get<boolean>('secrets.enabled', true)) {
    collection.delete(doc.uri);
    return 0;
  }
  const diags = scanDocument(doc);
  collection.set(doc.uri, diags);
  return diags.length;
}

function isLintOnSave(): boolean {
  const cfg = vscode.workspace.getConfiguration('ansibleToolkit');
  return cfg.get<boolean>('lint.onSave', true);
}

/**
 * Sequential run queue in a colab-notebook style. Steps are determined by:
 *   1. if `run-queue.yml` exists in the root — read the command/playbook list from it;
 *   2. otherwise — multi-select .yml playbooks via QuickPick.
 * Steps run sequentially, with progress logged to an OutputChannel.
 */
async function runQueue(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0];
  if (!root) {
    void vscode.window.showWarningMessage('No folder is open.');
    return;
  }

  const queueFile = findFirstExisting([
    path.join(root.uri.fsPath, 'run-queue.yml'),
    path.join(root.uri.fsPath, 'run-queue.yaml'),
  ]);

  let steps: RunStep[] = [];
  if (queueFile) {
    steps = parseQueueFile(queueFile, root.uri.fsPath);
    if (steps.length === 0) {
      void vscode.window.showWarningMessage(
        `Queue file ${path.basename(queueFile)} is empty or contains no commands.`,
      );
      return;
    }
  } else {
    const picks = await pickPlaybooks(root.uri.fsPath);
    if (!picks || picks.length === 0) return;
    steps = picks.map((p) => ({
      title: path.basename(p),
      command: p,
      isPlaybook: true,
    }));
  }

  void vscode.window.showInformationMessage(
    `Running queue of ${steps.length} steps...`,
  );

  await runSequential(steps, (step, idx, total) => {
    void vscode.window.showInformationMessage(`[${idx + 1}/${total}] ${step.title}`);
  });
}

/** Multi-select playbooks (all .yml/.yaml in the root, except special ones). */
async function pickPlaybooks(root: string): Promise<string[] | undefined> {
  const entries = listPlaybookFiles(root);

  if (entries.length === 0) {
    void vscode.window.showInformationMessage('No .yml files in the root for a queue.');
    return undefined;
  }

  const picks = await vscode.window.showQuickPick(
    entries.map((e) => ({ label: e, picked: false })),
    {
      placeHolder: 'Select playbooks (Enter to confirm, Space to multi-select)',
      canPickMany: true,
    },
  );
  if (!picks) return undefined;
  return picks.map((p) => path.join(root, p.label));
}

export function deactivate(): void {}
