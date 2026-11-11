import { ANSIBLE_MODULES, moduleByName, moduleOptions } from '../completion/modules';
import type { WizardState } from '../wizard/state';

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
  const m = moduleByName(name);
  return m ? moduleOptions(m) : [];
}

/* ------------------------------------------------------------------ */
/* Wizard generation                                                   */
/* ------------------------------------------------------------------ */

export interface WizardOutput {
  /** Role scaffolding files (only when intent is 'role'). */
  files: Array<{ path: string; content: string }>;
  /** Playbook/task YAML to insert into the editor (empty for role intent). */
  yaml: string;
}

/**
 * Turns a wizard state into concrete artefacts. Reuses the existing
 * single-task/playbook/role generators so quoting and structure stay
 * consistent with the legacy form.
 */
export function generateFromWizard(state: WizardState): WizardOutput {
  if (state.intent === 'role') {
    const files = generateRoleFiles({
      name: state.role?.name ?? '',
      includeTemplates: state.role?.includeTemplates ?? true,
      includeMeta: state.role?.includeMeta ?? true,
    });
    return { files, yaml: '' };
  }

  const play = state.play ?? { name: '', hosts: 'all', become: false, gatherFacts: true, roles: [] };

  if (state.intent === 'playbook') {
    const yaml = generatePlaybookYaml({
      name: play.name,
      hosts: play.hosts,
      become: play.become,
      gatherFacts: play.gatherFacts,
      vault: false,
      roles: play.roles,
    });
    // Replace the placeholder example task with the wizard's tasks if any.
    const taskBlocks = state.tasks
      .filter((t) => t.module.trim())
      .map((t) =>
        generateTaskYaml({
          name: t.name,
          module: t.module,
          options: t.options.filter((o) => o.key.trim()),
          indent: 4,
        }),
      );
    if (taskBlocks.length > 0) {
      const lines = yaml.split('\n');
      const hostIdx = lines.findIndex((l) => /^\s+hosts:/.test(l));
      const anchor = lines.findIndex((l, i) => i > hostIdx && /^\s+tasks:/.test(l));
      if (anchor >= 0) {
        const head = lines.slice(0, anchor + 1);
        const tail = lines.slice(anchor + 1);
        const body = tail.filter((l) => l.trim() !== '' && !/^\s+- name: Example task/.test(l) && !/^\s+debug:/.test(l) && !/^\s+msg:/.test(l));
        lines.length = 0;
        lines.push(...head, ...taskBlocks);
        if (body.length) lines.push(...body);
      }
      return { files: [], yaml: lines.join('\n') + '\n' };
    }
    return { files: [], yaml };
  }

  // Single task intent.
  const task = state.tasks[0];
  if (!task || !task.module.trim()) return { files: [], yaml: '' };
  const yaml = generateTaskYaml({
    name: task.name,
    module: task.module,
    options: task.options.filter((o) => o.key.trim()),
    indent: 0,
  });
  return { files: [], yaml: yaml + '\n' };
}
