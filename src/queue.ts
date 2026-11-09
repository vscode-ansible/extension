import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { RunStep } from './runner';

/** Finds the first existing file from the list. */
export function findFirstExisting(paths: string[]): string | null {
  for (const p of paths) {
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      /* skip */
    }
  }
  return null;
}

/**
 * Parses `run-queue.yml` into a list of steps. Supported forms:
 *   commands:
 *     - name: Install dependencies
 *       run: ansible-playbook deps.yml
 *     - name: Deploy
 *       playbook: deploy.yml
 *     - echo 'hello'            # a bare command string as a single item
 */
export function parseQueueFile(filePath: string, root: string): RunStep[] {
  let doc: unknown;
  try {
    doc = parseYaml(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }

  if (!Array.isArray(doc)) {
    const obj = doc as Record<string, unknown> | null;
    const list = Array.isArray(obj?.commands)
      ? obj?.commands
      : Array.isArray(obj?.steps)
        ? obj?.steps
        : null;
    if (!Array.isArray(list)) return [];
    doc = list;
  }

  const steps: RunStep[] = [];
  for (const item of doc as unknown[]) {
    if (typeof item === 'string') {
      const step = stringToStep(item, root);
      if (step) steps.push(step);
      continue;
    }
    const obj = item as Record<string, unknown>;
    const title = typeof obj?.name === 'string' ? obj.name : undefined;
    const command =
      typeof obj?.run === 'string' ? obj.run : typeof obj?.cmd === 'string' ? obj.cmd : undefined;
    const playbook = typeof obj?.playbook === 'string' ? obj.playbook : undefined;

    if (command) {
      steps.push({ title: title ?? command, command });
    } else if (playbook) {
      steps.push({
        title: title ?? playbook,
        command: path.isAbsolute(playbook) ? playbook : path.join(root, playbook),
        isPlaybook: true,
      });
    }
  }
  return steps;
}

/** Converts a single queue line into a step (type determined by extension). */
export function stringToStep(raw: string, root: string): RunStep | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // A playbook is a single .yml file name without spaces (otherwise it is a command).
  if (/^[^\s]+\.[yY][aA]?[mM][lL]$/.test(trimmed)) {
    const full = path.isAbsolute(trimmed) ? trimmed : path.join(root, trimmed);
    return { title: trimmed, command: full, isPlaybook: true };
  }
  return { title: trimmed, command: trimmed };
}

/** Lists .yml/.yaml files in the root, except special ones. */
export function listPlaybookFiles(root: string): string[] {
  try {
    return fs
      .readdirSync(root)
      .filter(
        (f) =>
          /\.ya?ml$/i.test(f) &&
          !/requirements\.ya?ml/i.test(f) &&
          !/run-queue\.ya?ml/i.test(f),
      )
      .sort();
  } catch {
    return [];
  }
}
