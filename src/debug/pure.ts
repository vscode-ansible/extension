export interface Breakpoint {
  id: string;
  enabled: boolean;
  anchor: 'task-name' | 'task-index';
  pattern: string;
  index: number;
}

export interface BreakpointMatch {
  breakpointId: string;
  targetTask: string;
  targetIndex: number;
}

let seq = 0;

export function nextId(now: number = Date.now()): string {
  seq += 1;
  return `${now}-${seq}`;
}

/** Normalizes `--list-tasks` output into an ordered task-name list. */
export function parseTaskNames(listTasksOutput: string): string[] {
  const names: string[] = [];
  for (const raw of listTasksOutput.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^TASK\s*\[(.+)\]\s*$/);
    if (m) {
      if (m[1]?.trim()) names.push(m[1].trim());
      continue;
    }
    const bare = line.replace(/^[\s*-]+/, '').replace(/\s+\*{2,}\s*$/, '').trim();
    if (bare) names.push(bare);
  }
  return names;
}

export function matchBreakpoint(breakpoint: Breakpoint, taskNames: string[]): BreakpointMatch | null {
  if (!breakpoint.enabled) return null;
  if (breakpoint.anchor === 'task-index') {
    const idx = breakpoint.index - 1;
    const target = taskNames[idx];
    if (idx < 0 || target === undefined) return null;
    return { breakpointId: breakpoint.id, targetTask: target, targetIndex: breakpoint.index };
  }
  let pattern: RegExp;
  try {
    pattern = new RegExp(breakpoint.pattern);
  } catch {
    return null;
  }
  for (let i = 0; i < taskNames.length; i++) {
    const name = taskNames[i];
    if (name !== undefined && pattern.test(name)) {
      return { breakpointId: breakpoint.id, targetTask: name, targetIndex: i + 1 };
    }
  }
  return null;
}

/** Splits a free-form command into argv, respecting quotes. */
export function parseRunArgs(cmd: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  const push = () => {
    if (current.length > 0) {
      args.push(current);
      current = '';
    }
  };

  for (const ch of cmd) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ' ' || ch === '\t' || ch === '\n') {
      push();
    } else {
      current += ch;
    }
  }
  push();
  return args;
}
