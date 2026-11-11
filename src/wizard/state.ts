/**
 * Pure state model for the Ansible constructor wizard. No VS Code imports so
 * the reducer can be unit-tested directly.
 */

export type WizardIntent = 'playbook' | 'role' | 'task';

export interface PlayDraft {
  name: string;
  hosts: string;
  become: boolean;
  gatherFacts: boolean;
  roles: string[];
}

export interface RoleDraft {
  name: string;
  includeTemplates: boolean;
  includeMeta: boolean;
}

export interface TaskOption {
  key: string;
  value: string;
}

export interface TaskDraft {
  name: string;
  module: string;
  options: TaskOption[];
}

export interface WizardState {
  /** Which build target was chosen. */
  intent?: WizardIntent;
  play?: PlayDraft;
  role?: RoleDraft;
  tasks: TaskDraft[];
  /** Index of the task currently being edited. */
  activeTaskIndex: number;
  /** True once YAML has been generated (final step). */
  generated: boolean;
}

export function initialWizardState(): WizardState {
  return { tasks: [], activeTaskIndex: 0, generated: false };
}

/** A single answer from the UI, tagged by field. */
export type WizardAnswer =
  | { kind: 'intent'; intent: WizardIntent }
  | { kind: 'play'; patch: Partial<PlayDraft> }
  | { kind: 'role'; patch: Partial<RoleDraft> }
  | { kind: 'task-name'; name: string }
  | { kind: 'task-module'; module: string }
  | { kind: 'task-option'; index: number; field: 'key' | 'value'; value: string }
  | { kind: 'task-option-add' }
  | { kind: 'task-option-remove'; index: number }
  | { kind: 'task-add' }
  | { kind: 'task-select'; index: number }
  | { kind: 'generate' };

function newTask(): TaskDraft {
  return { name: '', module: '', options: [] };
}

/** Immutably applies one answer to the state. */
export function applyAnswer(state: WizardState, answer: WizardAnswer): WizardState {
  switch (answer.kind) {
    case 'intent':
      return {
        ...state,
        intent: answer.intent,
        play: answer.intent === 'playbook' ? { name: '', hosts: 'all', become: false, gatherFacts: true, roles: [] } : state.play,
        role: answer.intent === 'role' ? { name: '', includeTemplates: true, includeMeta: true } : state.role,
        tasks: answer.intent === 'task' && state.tasks.length === 0 ? [newTask()] : state.tasks,
      };

    case 'play':
      return { ...state, play: { ...(state.play ?? { name: '', hosts: 'all', become: false, gatherFacts: true, roles: [] }), ...answer.patch } };

    case 'role':
      return { ...state, role: { ...(state.role ?? { name: '', includeTemplates: true, includeMeta: true }), ...answer.patch } };

    case 'task-name': {
      const tasks = [...state.tasks];
      tasks[state.activeTaskIndex] = { ...tasks[state.activeTaskIndex]!, name: answer.name };
      return { ...state, tasks };
    }

    case 'task-module': {
      const tasks = [...state.tasks];
      const current = tasks[state.activeTaskIndex] ?? newTask();
      tasks[state.activeTaskIndex] = { ...current, module: answer.module };
      return { ...state, tasks };
    }

    case 'task-option': {
      const tasks = state.tasks.map((t, i) =>
        i === state.activeTaskIndex
          ? {
              ...t,
              options: t.options.map((o, j) =>
                j === answer.index ? { ...o, [answer.field]: answer.value } : o,
              ),
            }
          : t,
      );
      return { ...state, tasks };
    }

    case 'task-option-add': {
      const tasks = state.tasks.map((t, i) =>
        i === state.activeTaskIndex ? { ...t, options: [...t.options, { key: '', value: '' }] } : t,
      );
      return { ...state, tasks };
    }

    case 'task-option-remove': {
      const tasks = state.tasks.map((t, i) =>
        i === state.activeTaskIndex ? { ...t, options: t.options.filter((_, j) => j !== answer.index) } : t,
      );
      return { ...state, tasks };
    }

    case 'task-add':
      return { ...state, tasks: [...state.tasks, newTask()], activeTaskIndex: state.tasks.length };

    case 'task-select':
      return { ...state, activeTaskIndex: answer.index };

    case 'generate':
      return { ...state, generated: true };

    default:
      return state;
  }
}

/** Human hint for what to do next, as an i18n key (values filled by the UI). */
export function nextHintKey(state: WizardState): string {
  if (state.generated) return 'wizard.suggest.done';
  if (!state.intent) return 'wizard.suggest.intent';
  if (state.intent === 'role') return 'wizard.suggest.play';
  if (state.intent === 'playbook') return state.tasks.length === 0 ? 'wizard.suggest.play' : 'wizard.suggest.task';
  return 'wizard.suggest.task';
}

/** True when the current step is complete enough to advance/generate. */
export function canGenerate(state: WizardState): boolean {
  if (!state.intent) return false;
  if (state.intent === 'role') return (state.role?.name.trim().length ?? 0) > 0;
  if (state.intent === 'playbook') return (state.play?.name.trim().length ?? 0) > 0;
  // single task
  const task = state.tasks[0];
  return !!task && task.module.trim().length > 0 && task.name.trim().length > 0;
}
