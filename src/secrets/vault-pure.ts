/** Pure vault helpers (no `vscode` import) so they are unit-testable. */

export type VaultAction = 'encrypt' | 'decrypt' | 'view' | 'create';

/** True when content is an ansible-vault blob. */
export function isVaultFile(content: string): boolean {
  return /^\$ANSIBLE_VAULT;/.test(content.trimStart());
}

/**
 * Builds the exact argv for an ansible-vault invocation. `action` is one of
 * encrypt/decrypt/view/create. `passwordFile` is optional; when omitted
 * ansible-vault prompts on the controlling terminal.
 */
export function buildVaultArgs(action: VaultAction, filePath: string, passwordFile?: string): string[] {
  const argv: string[] = [action];
  if (passwordFile) argv.push('--vault-password-file', passwordFile);
  argv.push(filePath);
  return argv;
}
