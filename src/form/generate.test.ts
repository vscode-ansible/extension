import { describe, it, expect } from 'vitest';
import {
  generateTaskYaml,
  generatePlaybookYaml,
  generateRoleFiles,
  listModuleOptions,
} from './generate';

describe('generateTaskYaml', () => {
  it('renders a task with module and options', () => {
    const yaml = generateTaskYaml({
      name: 'Install nginx',
      module: 'apt',
      options: [
        { key: 'name', value: 'nginx' },
        { key: 'state', value: 'present' },
      ],
      indent: 0,
    });
    expect(yaml).toContain('- name: Install nginx');
    expect(yaml).toContain('  apt:');
    expect(yaml).toContain('    name: nginx');
    expect(yaml).toContain('    state: present');
  });

  it('quotes values with special chars', () => {
    const yaml = generateTaskYaml({
      name: 'Do a: thing',
      module: 'debug',
      options: [{ key: 'msg', value: 'hello: world' }],
      indent: 0,
    });
    expect(yaml).toContain('"hello: world"');
  });

  it('indents per the provided level', () => {
    const yaml = generateTaskYaml({
      name: 'x',
      module: 'debug',
      options: [{ key: 'msg', value: 'y' }],
      indent: 4,
    });
    expect(yaml.split('\n')[0]).toBe('    - name: x');
  });
});

describe('generatePlaybookYaml', () => {
  it('produces a full playbook', () => {
    const yaml = generatePlaybookYaml({
      name: 'Setup',
      hosts: 'webservers',
      become: true,
      gatherFacts: false,
      vault: false,
      roles: ['webserver', 'db'],
    });
    expect(yaml).toContain('- name: Setup');
    expect(yaml).toContain('  hosts: webservers');
    expect(yaml).toContain('  become: true');
    expect(yaml).toContain('  gather_facts: false');
    expect(yaml).toContain('    - webserver');
    expect(yaml).toContain('    - db');
  });
});

describe('generateRoleFiles', () => {
  it('creates the standard role structure', () => {
    const files = generateRoleFiles({
      name: 'my_role',
      includeTemplates: true,
      includeMeta: true,
    });
    const paths = files.map((f) => f.path);
    expect(paths).toContain('roles/my_role/tasks/main.yml');
    expect(paths).toContain('roles/my_role/handlers/main.yml');
    expect(paths).toContain('roles/my_role/defaults/main.yml');
    expect(paths).toContain('roles/my_role/meta/main.yml');
    expect(paths).toContain('roles/my_role/templates/.gitkeep');
  });
});

describe('listModuleOptions', () => {
  it('returns options for a known module', () => {
    expect(listModuleOptions('apt')).toContain('name');
    expect(listModuleOptions('apt')).toContain('state');
  });
  it('returns empty for unknown module', () => {
    expect(listModuleOptions('nope')).toEqual([]);
  });
});
