import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export type VarTarget = 'group' | 'host' | 'play';

export interface VarFileRef {
  fsPath: string;
  target: VarTarget;
  name: string;
}

/** True when the file content is an ansible-vault blob (opaque, not editable YAML). */
export function isVaultContent(content: string): boolean {
  return /^\$ANSIBLE_VAULT;/.test(content.trimStart());
}

function fileList(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f)).sort();
  } catch {
    return [];
  }
}

/**
 * Lists variables files reachable in the project: `group_vars/*`, `host_vars/*`,
 * and `playbook vars:`. Play vars have no separate file, so they are surfaced
 * only via `readPlaybookVars`.
 */
export function listVarFiles(root: string): VarFileRef[] {
  const refs: VarFileRef[] = [];

  const groupDir = path.join(root, 'group_vars');
  for (const f of fileList(groupDir)) {
    refs.push({ fsPath: path.join(groupDir, f), target: 'group', name: f.replace(/\.ya?ml$/i, '') });
  }

  const hostDir = path.join(root, 'host_vars');
  for (const f of fileList(hostDir)) {
    refs.push({ fsPath: path.join(hostDir, f), target: 'host', name: f.replace(/\.ya?ml$/i, '') });
  }

  // Role defaults also carry variables.
  const rolesDir = path.join(root, 'roles');
  try {
    for (const role of fs.readdirSync(rolesDir)) {
      const defaults = path.join(rolesDir, role, 'defaults', 'main.yml');
      if (fs.existsSync(defaults)) {
        refs.push({ fsPath: defaults, target: 'play', name: `role:${role}:defaults` });
      }
    }
  } catch {
    /* no roles dir */
  }

  return refs;
}

/**
 * Reads a vars file as a mapping. Vault files are returned as
 * `{ __vault: true }` plus a `__content` raw copy so the UI knows to treat it
 * as opaque.
 */
export function readVars(filePath: string): Record<string, unknown> {
  let text: string;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return {};
  }
  if (isVaultContent(text)) {
    return { __vault: true, __content: text };
  }
  try {
    const doc = parseYaml(text);
    if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
      return doc as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/** Writes a vars mapping back to disk, round-tripping scalars/lists/dicts. */
export function writeVars(filePath: string, vars: Record<string, unknown>): void {
  const current = readVars(filePath);
  if ((current as Record<string, unknown>).__vault === true) {
    throw new Error('Refusing to write over an encrypted vault file.');
  }
  const body = stringifyYaml(vars, { indent: 2 });
  fs.writeFileSync(filePath, body);
}

/** Adds or replaces one variable in a vars file. */
export function upsertVar(filePath: string, key: string, value: unknown): void {
  const vars = readVars(filePath);
  if ((vars as Record<string, unknown>).__vault === true) {
    throw new Error('Refusing to write over an encrypted vault file.');
  }
  vars[key] = value;
  writeVars(filePath, vars);
}
