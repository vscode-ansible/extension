import { describe, it, expect } from 'vitest';
import { t, setLanguage, currentLanguage } from './index';

describe('i18n', () => {
  it('resolves keys in the active language', () => {
    setLanguage('en');
    expect(t('common.run')).toBe('Run');
    setLanguage('ru');
    expect(t('common.run')).toBe('Запустить');
  });

  it('falls back to English for a missing key without throwing', () => {
    setLanguage('ru');
    // 'common.loading' exists in both; force a truly missing key.
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('interpolates placeholders', () => {
    setLanguage('en');
    expect(t('wizard.next.hint', { suggestion: 'add tasks' })).toBe('Next: add tasks');
  });

  it('normalizes unknown languages to English', () => {
    setLanguage('de');
    expect(currentLanguage()).toBe('en');
  });
});
