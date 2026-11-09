import { describe, it, expect } from 'vitest';
import { parseTaskNames, matchBreakpoint, parseRunArgs } from './pure';

describe('parseTaskNames', () => {
  it('извлекает задачи из --list-tasks', () => {
    const out = 'TASK [Gathering Facts]\nTASK [Install nginx]\nTASK [Restart nginx]\n';
    expect(parseTaskNames(out)).toEqual(['Gathering Facts', 'Install nginx', 'Restart nginx']);
  });

  it('обрабатывает вложенные/отступные строки', () => {
    const out = 'play #1\n  TASK [First task]\n  TASK [Second task]\n';
    const names = parseTaskNames(out);
    expect(names).toContain('First task');
    expect(names).toContain('Second task');
  });
});

describe('matchBreakpoint', () => {
  const tasks = ['Task A', 'Install nginx', 'Restart'];

  it('по имени задачи', () => {
    const m = matchBreakpoint(
      { id: '1', enabled: true, anchor: 'task-name', pattern: 'nginx', index: 0 },
      tasks,
    );
    expect(m?.targetTask).toBe('Install nginx');
  });

  it('по индексу', () => {
    const m = matchBreakpoint(
      { id: '1', enabled: true, anchor: 'task-index', pattern: '', index: 2 },
      tasks,
    );
    expect(m?.targetTask).toBe('Install nginx');
  });

  it('возвращает null для отключённой точки', () => {
    const m = matchBreakpoint(
      { id: '1', enabled: false, anchor: 'task-name', pattern: 'nginx', index: 0 },
      tasks,
    );
    expect(m).toBeNull();
  });
});

describe('parseRunArgs', () => {
  it('разбивает команду с кавычками', () => {
    expect(parseRunArgs('ansible-playbook -i "inventory/hosts" play.yml')).toEqual([
      'ansible-playbook',
      '-i',
      'inventory/hosts',
      'play.yml',
    ]);
  });

  it('обрабатывает одинарные кавычки', () => {
    expect(parseRunArgs("echo 'hello world'")).toEqual(['echo', 'hello world']);
  });
});
