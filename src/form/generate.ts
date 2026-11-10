import { ANSIBLE_MODULES, moduleByName } from '../completion/modules';

export interface TaskFormValue {
  name: string;
  module: string;
  options: Array<{ key: string; value: string }>;
  indent: number;
}

export interface PlaybookFormValue {
  name: string;
  hosts: string;
  become: boolean;
  gatherFacts: boolean;
  roles: string[];
  vault: boolean;
}

export interface RoleFormValue {
  name: string;
  includeTemplates: boolean;
  includeMeta: boolean;
}

function quoteYaml(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '""';
  if (/^(true|false|null|~)$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^[[{].*[}\]]$/.test(trimmed)) return trimmed;
  if (/^["'].*["']$/.test(trimmed)) return trimmed;
  if ("{.,\"'[]:&*#?|@!%`}".split('').some((c) => trimmed.includes(c))) {
    return JSON.stringify(trimmed);
  }
  return trimmed;
}

/** Generates YAML for a single task (the `- name:` block with module + options). */
export function generateTaskYaml(task: TaskFormValue): string {
  const pad = ' '.repeat(task.indent);
  const lines: string[] = [];
  lines.push(`${pad}- name: ${quoteYaml(task.name || 'task name')}`);
  lines.push(`${pad}  ${task.module}:`);
  if (task.options.length === 0) {
    lines.push(`${pad}    # ${moduleDoc(task.module) ?? 'module options'}`);
  }
  for (const opt of task.options) {
    if (!opt.key.trim()) continue;
    lines.push(`${pad}    ${opt.key.trim()}: ${quoteYaml(opt.value)}`);
  }
  return lines.join('\n');
}

function moduleDoc(name: string): string {
  return moduleByName(name)?.doc ?? '';
}

/** Generates a full playbook YAML from the form. */
export function generatePlaybookYaml(form: PlaybookFormValue): string {
  const lines: string[] = ['---'];
  lines.push(`- name: ${quoteYaml(form.name || 'playbook')}`);
  lines.push(`  hosts: ${quoteYaml(form.hosts || 'all')}`);
  if (form.become) lines.push('  become: true');
  if (!form.gatherFacts) lines.push('  gather_facts: false');
  if (form.vault) lines.push('  vars_files:');
  if (form.vault) lines.push('    - group_vars/vault.yml');
  if (form.roles.length > 0) {
    lines.push('  roles:');
    for (const role of form.roles) {
      if (!role.trim()) continue;
      lines.push(`    - ${role.trim()}`);
    }
  } else {
    lines.push('  tasks:');
    lines.push('    - name: Example task');
    lines.push('      debug:');
    lines.push('        msg: Hello, world');
  }
  return lines.join('\n') + '\n';
}

/** Generates the files-fragment of a role (paths relative to roles/<name>/). */
export function generateRoleFiles(form: RoleFormValue): Array<{ path: string; content: string }> {
  const role = form.name.trim() || 'my_role';
  const prefix = `roles/${role}`;
  const files: Array<{ path: string; content: string }> = [];

  files.push({
    path: `${prefix}/tasks/main.yml`,
    content: ['---', '# Tasks for role ' + role, ''].join('\n'),
  });
  files.push({
    path: `${prefix}/handlers/main.yml`,
    content: ['---', '# Handlers for role ' + role, ''].join('\n'),
  });
  files.push({
    path: `${prefix}/defaults/main.yml`,
    content: ['---', '# Default variables for role ' + role, ''].join('\n'),
  });

  if (form.includeMeta) {
    files.push({
      path: `${prefix}/meta/main.yml`,
      content: ['---', 'dependencies: []', ''].join('\n'),
    });
  }
  if (form.includeTemplates) {
    files.push({
      path: `${prefix}/templates/.gitkeep`,
      content: '',
    });
  }
  return files;
}

/** Lists module names for the form's autocomplete. */
export function listModuleNames(): string[] {
  return ANSIBLE_MODULES.map((m) => m.name);
}

export function listModuleOptions(name: string): string[] {
  return moduleByName(name)?.options ?? [];
}
