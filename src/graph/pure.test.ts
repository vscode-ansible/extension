import { describe, it, expect } from 'vitest';
import { shapeRuntime, shapeInventory, shapePlaybookDetail, taskModule } from './pure';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'graph-'));
}

describe('taskModule', () => {
  it('extracts the module name from a task', () => {
    expect(taskModule({ name: 'x', apt: { name: 'nginx' } })).toBe('apt');
    expect(taskModule({ name: 'y', copy: {} })).toBe('copy');
  });
});

describe('shapePlaybookDetail', () => {
  it('builds playbook → play → role → task flow with notify edges', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'site.yml'), [
      '---',
      '- name: Configure',
      '  hosts: webservers',
      '  roles:',
      '    - webserver',
    ].join('\n'));
    fs.mkdirSync(path.join(dir, 'roles', 'webserver', 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'roles', 'webserver', 'tasks', 'main.yml'), [
      '---',
      '- name: Install nginx',
      '  apt:',
      '    name: nginx',
      '  notify: restart nginx',
    ].join('\n'));
    fs.mkdirSync(path.join(dir, 'roles', 'webserver', 'handlers'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'roles', 'webserver', 'handlers', 'main.yml'), [
      '---',
      '- name: restart nginx',
      '  service:',
      '    name: nginx',
      '    state: restarted',
    ].join('\n'));

    const g = shapePlaybookDetail(dir, 'site.yml');
    expect(g.nodes.some((n) => n.kind === 'playbook' && n.label === 'site.yml')).toBe(true);
    expect(g.nodes.some((n) => n.kind === 'play' && n.label === 'Configure')).toBe(true);
    expect(g.nodes.some((n) => n.kind === 'role' && n.label === 'webserver')).toBe(true);
    expect(g.nodes.some((n) => n.kind === 'task' && n.label === 'Install nginx')).toBe(true);
    // notify edge task → handler
    expect(g.edges.some((e) => e.label === 'notifies')).toBe(true);
  });
});

describe('shapeRuntime', () => {
  it('builds a play -> task -> result graph', () => {
    const out = [
      'PLAY [Deploy app]',
      'TASK [Install packages]',
      'ok: [web1]',
      'changed: [web2]',
      'TASK [Restart]',
      'failed: [web3]',
    ].join('\n');
    const g = shapeRuntime(out);
    expect(g.nodes.filter((n) => n.kind === 'play').length).toBeGreaterThan(0);
    expect(g.nodes.some((n) => n.kind === 'result' && n.status === 'changed')).toBe(true);
    expect(g.nodes.some((n) => n.kind === 'result' && n.status === 'failed')).toBe(true);
  });

  it('recognizes unreachable', () => {
    const out = 'PLAY [Play]\nfatal: [host1]: UNREACHABLE! => {}\n';
    const g = shapeRuntime(out);
    expect(g.nodes.some((n) => n.status === 'unreachable')).toBe(true);
  });
});

describe('shapeInventory', () => {
  it('builds a group and host graph', () => {
    const json = {
      all: { children: ['web'] },
      web: { hosts: ['web1', 'web2'] },
      db: { hosts: ['db1'] },
      _meta: {},
    };
    const g = shapeInventory(json as never);
    expect(g.nodes.some((n) => n.kind === 'group' && n.label === 'all')).toBe(true);
    expect(g.nodes.filter((n) => n.kind === 'host').length).toBeGreaterThan(0);
    expect(g.edges.some((e) => e.source === 'group:all' && e.target === 'group:web')).toBe(true);
  });
});
