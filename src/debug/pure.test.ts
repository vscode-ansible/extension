import { describe, it, expect } from 'vitest';
import { parseTaskNames, parseTaskTree, matchBreakpoint, parseRunArgs } from './pure';

describe('parseTaskNames', () => {
  it('extracts tasks from --list-tasks', () => {
    const out = 'TASK [Gathering Facts]\nTASK [Install nginx]\nTASK [Restart nginx]\n';
    expect(parseTaskNames(out)).toEqual(['Gathering Facts', 'Install nginx', 'Restart nginx']);
  });

  it('handles nested/indented lines', () => {
    const out = 'play #1\n  TASK [First task]\n  TASK [Second task]\n';
    const names = parseTaskNames(out);
    expect(names).toContain('First task');
    expect(names).toContain('Second task');
  });
});

describe('matchBreakpoint', () => {
  const tasks = ['Task A', 'Install nginx', 'Restart'];

  it('matches by task name', () => {
    const m = matchBreakpoint(
      { id: '1', enabled: true, anchor: 'task-name', pattern: 'nginx', index: 0 },
      tasks,
    );
    expect(m?.targetTask).toBe('Install nginx');
  });

  it('matches by index', () => {
    const m = matchBreakpoint(
      { id: '1', enabled: true, anchor: 'task-index', pattern: '', index: 2 },
      tasks,
    );
    expect(m?.targetTask).toBe('Install nginx');
  });

  it('returns null for a disabled breakpoint', () => {
    const m = matchBreakpoint(
      { id: '1', enabled: false, anchor: 'task-name', pattern: 'nginx', index: 0 },
      tasks,
    );
    expect(m).toBeNull();
  });
});

describe('parseTaskTree', () => {
  it('splits plays and strips role prefixes', () => {
    const out = [
      'play #1 (webservers): Configure webservers\tTAGS: []',
      '  tasks:',
      '    webserver : Install nginx\tTAGS: []',
      '    webserver : Deploy index page\tTAGS: []',
      'play #2 (dbservers): Configure database\tTAGS: []',
      '  tasks:',
      '    db : Install PostgreSQL\tTAGS: []',
    ].join('\n');
    const plays = parseTaskTree(out);
    expect(plays).toHaveLength(2);
    expect(plays[0]?.hosts).toBe('webservers');
    expect(plays[0]?.tasks.map((t) => t.name)).toEqual([
      'Install nginx',
      'Deploy index page',
    ]);
    expect(plays[1]?.tasks[0]?.name).toBe('Install PostgreSQL');
  });

  it('rebuilds nesting from indentation', () => {
    const out = [
      'play #1 (all): Play\tTAGS: []',
      '  tasks:',
      '    role : Install packages\tTAGS: []',
      '      include : Configure\tTAGS: []',
      '      include : Restart service\tTAGS: []',
    ].join('\n');
    const plays = parseTaskTree(out);
    const root = plays[0]?.tasks[0];
    expect(root?.name).toBe('Install packages');
    expect(root?.children.map((c) => c.name)).toEqual(['Configure', 'Restart service']);
    expect(root?.children[0]?.play).toBe('Play');
  });
});

describe('parseRunArgs', () => {
  it('splits a command with quotes', () => {
    expect(parseRunArgs('ansible-playbook -i "inventory/hosts" play.yml')).toEqual([
      'ansible-playbook',
      '-i',
      'inventory/hosts',
      'play.yml',
    ]);
  });

  it('handles single quotes', () => {
    expect(parseRunArgs("echo 'hello world'")).toEqual(['echo', 'hello world']);
  });
});
