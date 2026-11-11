import { describe, it, expect } from 'vitest';
import { listVarFiles, readVars, writeVars, upsertVar, isVaultContent } from './store';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vars-'));
}

describe('listVarFiles', () => {
  it('finds group_vars, host_vars, and role defaults', () => {
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'group_vars'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'host_vars'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'group_vars', 'webservers.yml'), '');
    fs.writeFileSync(path.join(dir, 'host_vars', 'web1.yml'), '');

    const refs = listVarFiles(dir);
    expect(refs.some((r) => r.name === 'webservers' && r.target === 'group')).toBe(true);
    expect(refs.some((r) => r.name === 'web1' && r.target === 'host')).toBe(true);
  });
});

describe('readVars/writeVars round-trip', () => {
  it('round-trips scalar, list, and nested dict', () => {
    const dir = tmpdir();
    const file = path.join(dir, 'v.yml');
    const vars = { enabled: true, ports: [80, 443], db: { host: 'x', port: 5432 } };
    writeVars(file, vars);
    expect(readVars(file)).toEqual(vars);
  });

  it('upsertVar adds a key', () => {
    const dir = tmpdir();
    const file = path.join(dir, 'v.yml');
    writeVars(file, { a: 1 });
    upsertVar(file, 'b', 'two');
    expect(readVars(file)).toEqual({ a: 1, b: 'two' });
  });
});

describe('isVaultContent', () => {
  it('detects vault header', () => {
    expect(isVaultContent('$ANSIBLE_VAULT;1.1;AES256\n663864...')).toBe(true);
    expect(isVaultContent('---\nfoo: bar')).toBe(false);
  });

  it('readVars treats vault content as opaque', () => {
    const dir = tmpdir();
    const file = path.join(dir, 'vault.yml');
    fs.writeFileSync(file, '$ANSIBLE_VAULT;1.1;AES256\n663864');
    const vars = readVars(file);
    expect((vars as Record<string, unknown>).__vault).toBe(true);
  });
});
