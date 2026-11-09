import { describe, it, expect } from 'vitest';
import { parseTaskNames, matchBreakpoint, parseRunArgs } from './pure';

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
