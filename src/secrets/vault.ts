import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { runCommand, type SpawnResult } from '../runner';
import { buildVaultArgs, type VaultAction } from './vault-pure';

export { isVaultFile, buildVaultArgs, type VaultAction } from './vault-pure';

/** Resolves the ansible-vault executable from config (defaults to PATH). */
export function resolveVaultExecutable(): string {
  const cfg = vscode.workspace.getConfiguration('ansibleToolkit');
  return cfg.get<string>('ansibleVaultPath') ?? 'ansible-vault';
}

function cwd(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Prompts for a vault password and writes it to a temporary 0600 file, then
 * runs `ansible-vault` with `--vault-password-file` (works without a tty,
 * which is why the interactive `ansible-vault` prompt hung forever).
 */
async function runVaultPrompting(action: VaultAction, filePath: string): Promise<SpawnResult> {
  const password = await vscode.window.showInputBox({
    prompt: `Vault password for ${action}`,
    password: true,
    ignoreFocusOut: true,
  });
  if (password === undefined) {
    return { code: -1, output: 'Cancelled.' };
  }

  const tmpFile = path.join(os.tmpdir(), `ansible-vault-pw-${Date.now()}`);
  fs.writeFileSync(tmpFile, password + '\n', { mode: 0o600 });
  try {
    const args = buildVaultArgs(action, filePath, tmpFile);
    return await runCommand(resolveVaultExecutable(), args, cwd());
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* best effort */
    }
  }
}

export function encryptFile(filePath: string): Promise<SpawnResult> {
  return runVaultPrompting('encrypt', filePath);
}

export function decryptFile(filePath: string): Promise<SpawnResult> {
  return runVaultPrompting('decrypt', filePath);
}

export function viewFile(filePath: string): Promise<SpawnResult> {
  return runVaultPrompting('view', filePath);
}

export function createVaultFile(filePath: string): Promise<SpawnResult> {
  return runVaultPrompting('create', filePath);
}
