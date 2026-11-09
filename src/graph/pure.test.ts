import { describe, it, expect } from 'vitest';
import { shapeRuntime, shapeInventory } from './pure';

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
