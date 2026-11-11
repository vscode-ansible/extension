import { describe, it, expect } from 'vitest';
import { isVaultFile, buildVaultArgs } from './vault-pure';

describe('isVaultFile', () => {
  it('detects vault blobs', () => {
    expect(isVaultFile('$ANSIBLE_VAULT;1.1;AES256\n663864')).toBe(true);
    expect(isVaultFile('---\nfoo: bar')).toBe(false);
  });
});

describe('buildVaultArgs', () => {
  it('builds args without a password file', () => {
    expect(buildVaultArgs('encrypt', 'x.yml')).toEqual(['encrypt', 'x.yml']);
  });

  it('adds --vault-password-file when provided', () => {
    expect(buildVaultArgs('decrypt', 'x.yml', 'pw.txt')).toEqual([
      'decrypt',
      '--vault-password-file',
      'pw.txt',
      'x.yml',
    ]);
  });
});
