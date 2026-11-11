import { en, ru } from './catalogs';

export type Language = 'en' | 'ru';

const catalogs: Record<Language, Record<string, string>> = { en, ru };

let current: Language = 'en';

/** Sets the active language, normalizing unknown values to English. */
export function setLanguage(lang: string | undefined): void {
  current = lang === 'ru' ? 'ru' : 'en';
}

export function currentLanguage(): Language {
  return current;
}

/**
 * Resolves a message key with optional `{name}` placeholders. Missing keys
 * fall back to the English catalog, then to the key itself (never throws).
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  let text = catalogs[current][key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
