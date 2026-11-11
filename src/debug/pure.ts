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

export interface TaskStep {
  /** Flattened order index used by --start-at-task. */
  index: number;
  /** Task display name as ansible reports it (role prefix stripped later). */
  name: string;
  /** Tasks a role resolves into (indented children from --list-tasks). */
  children: TaskStep[];
  /** Play this task belongs to (for grouping in the panel). */
  play?: string;
}

export interface PlayBlock {
  name: string;
  hosts: string;
  tasks: TaskStep[];
}

/**
 * Parses `--list-tasks` output into plays and their tasks. The output formats
 * tasks as parent lines ending in `TAGS: [..]` with resolved child tasks
 * indented beneath them, e.g.:
 *
 *   play #1 (webservers): Configure webservers	TAGS: []
 *     tasks:
 *       webserver : Install nginx	TAGS: []
 *
 * Roles and include_tasks expand into nested children; we track indentation to
 * rebuild that tree so the panel can drill into a task and see its subtasks.
 */
export function parseTaskTree(listTasksOutput: string): PlayBlock[] {
  const plays: PlayBlock[] = [];
  let current: PlayBlock | null = null;
  // Stack of { depth, task } for the current nesting path.
  const stack: { depth: number; task: TaskStep }[] = [];
  let counter = 0;

  const playRe = /^play\s+#\d+\s*\(([^)]*)\)\s*:\s*(.*?)\s*TAGS:\s*\[.*\]$/;
  // A task line looks like: `  webserver : Install nginx	TAGS: []`
  const taskRe = /^(?:\S+\s*:\s*)?(.+?)\s*TAGS:\s*\[.*\]$/;

  for (const raw of listTasksOutput.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '' || line.trim() === 'tasks:') continue;

    const indent = raw.match(/^\s*/)?.[0].length ?? 0;

    const playMatch = line.trim().match(playRe);
    if (playMatch) {
      current = {
        name: (playMatch[2] ?? 'play').trim(),
        hosts: playMatch[1] ?? '',
        tasks: [],
      };
      plays.push(current);
      stack.length = 0;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed === 'tasks:') continue;

    const taskMatch = trimmed.match(taskRe);
    if (!taskMatch || !current) continue;
    const name = (taskMatch[1] ?? trimmed).trim();
    // Fall back to any non-header line that isn't "tasks:"/"play ..." already
    // handled above.

    while (stack.length && stack[stack.length - 1]!.depth >= indent) stack.pop();

    const task: TaskStep = {
      index: counter++,
      name,
      play: current.name,
      children: [],
    };

    if (stack.length === 0) {
      current.tasks.push(task);
    } else {
      stack[stack.length - 1]!.task.children.push(task);
    }
    stack.push({ depth: indent, task });
  }

  return plays;
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
