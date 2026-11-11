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

async function runVault(action: VaultAction, filePath: string, passwordFile?: string): Promise<SpawnResult> {
  const exec = resolveVaultExecutable();
  const args = buildVaultArgs(action, filePath, passwordFile);
  return runCommand(exec, args, cwd());
}

export function encryptFile(filePath: string, passwordFile?: string): Promise<SpawnResult> {
  return runVault('encrypt', filePath, passwordFile);
}

export function decryptFile(filePath: string, passwordFile?: string): Promise<SpawnResult> {
  return runVault('decrypt', filePath, passwordFile);
}

export function viewFile(filePath: string, passwordFile?: string): Promise<SpawnResult> {
  return runVault('view', filePath, passwordFile);
}

export function createVaultFile(filePath: string, passwordFile?: string): Promise<SpawnResult> {
  return runVault('create', filePath, passwordFile);
}
