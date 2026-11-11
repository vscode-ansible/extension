import { describe, it, expect } from 'vitest';
import { initialWizardState, applyAnswer, nextHintKey, canGenerate } from './state';

describe('wizard state', () => {
  it('transitions intent → playbook with default play', () => {
    let s = initialWizardState();
    s = applyAnswer(s, { kind: 'intent', intent: 'playbook' });
    expect(s.intent).toBe('playbook');
    expect(s.play?.hosts).toBe('all');
    expect(s.play?.gatherFacts).toBe(true);
  });

  it('sets play fields and adds a task', () => {
    let s = applyAnswer(initialWizardState(), { kind: 'intent', intent: 'playbook' });
    s = applyAnswer(s, { kind: 'play', patch: { name: 'Setup', hosts: 'webservers', become: true } });
    expect(s.play?.name).toBe('Setup');
    expect(s.play?.become).toBe(true);

    s = applyAnswer(s, { kind: 'task-add' });
    expect(s.tasks).toHaveLength(1);
    expect(s.activeTaskIndex).toBe(0);

    s = applyAnswer(s, { kind: 'task-name', name: 'Install nginx' });
    s = applyAnswer(s, { kind: 'task-module', module: 'apt' });
    s = applyAnswer(s, { kind: 'task-option-add' });
    s = applyAnswer(s, { kind: 'task-option', index: 0, field: 'key', value: 'name' });
    s = applyAnswer(s, { kind: 'task-option', index: 0, field: 'value', value: 'nginx' });
    expect(s.tasks[0]?.options).toEqual([{ key: 'name', value: 'nginx' }]);
  });

  it('updates hint as the flow advances', () => {
    let s = initialWizardState();
    expect(nextHintKey(s)).toBe('wizard.suggest.intent');
    s = applyAnswer(s, { kind: 'intent', intent: 'playbook' });
    expect(nextHintKey(s)).toBe('wizard.suggest.play');
    s = applyAnswer(s, { kind: 'task-add' });
    expect(nextHintKey(s)).toBe('wizard.suggest.task');
    s = applyAnswer(s, { kind: 'generate' });
    expect(nextHintKey(s)).toBe('wizard.suggest.done');
  });

  it('gates generation on required fields', () => {
    let s = initialWizardState();
    expect(canGenerate(s)).toBe(false);
    s = applyAnswer(s, { kind: 'intent', intent: 'task' });
    expect(canGenerate(s)).toBe(false);
    s = applyAnswer(s, { kind: 'task-name', name: 'Ping' });
    s = applyAnswer(s, { kind: 'task-module', module: 'ping' });
    expect(canGenerate(s)).toBe(true);
  });
});
