import { describe, it, expect } from 'vitest';
import { listSelectablePlaybooks, resolvePlaybookByLabel } from './playbooks';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'picker-'));
}

describe('listSelectablePlaybooks', () => {
  it('includes real playbooks and excludes requirements.yml', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'site.yml'), '---\n- name: play\n  hosts: all\n  tasks: []\n');
    fs.writeFileSync(path.join(dir, 'requirements.yml'), '---\ncollections: []\n');

    const list = listSelectablePlaybooks(dir);
    expect(list.map((p) => p.label)).toEqual(['site.yml']);
  });
});

describe('resolvePlaybookByLabel', () => {
  it('maps a label to its fs path', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'site.yml'), '---\n- hosts: all\n  tasks: []\n');
    expect(resolvePlaybookByLabel(dir, 'site.yml')).toBe(path.join(dir, 'site.yml'));
    expect(resolvePlaybookByLabel(dir, 'nope.yml')).toBeUndefined();
  });
});
