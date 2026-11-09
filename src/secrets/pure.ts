import { SECRET_PATTERNS } from './types';
import type { SecretFinding } from './types';

export interface ProjectFileRef {
  path: string;
  isVault?: boolean;
  content: string;
}

/**
 * Сканирует содержимое файлов проекта на секреты в открытом виде:
 * AWS access keys, приватные ключи, key=value присваивания с секретными
 * ключами. Возвращает список находок с позицией для подсветки в редакторе.
 */
export function findSecretLeaks(content: string): Array<{
  message: string;
  line: number;
  start: number;
  end: number;
}> {
  const findings: Array<{ message: string; line: number; start: number; end: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineText = line ?? '';

    if (SECRET_PATTERNS.awsAccessKey.test(lineText)) {
      findings.push({ message: 'Обнаружен AWS access key', line: i, start: 0, end: lineText.length });
    }
    if (SECRET_PATTERNS.privateKeyBlock.test(lineText)) {
      findings.push({ message: 'Обнаружен приватный ключ', line: i, start: 0, end: lineText.length });
    }

    const m = lineText.match(SECRET_PATTERNS.keyValueAssignment);
    if (m) {
      const start = m.index ?? 0;
      findings.push({
        message: `Потенциальный секрет в открытом виде (${m[1]}=…)`,
        line: i,
        start,
        end: start + m[0].length,
      });
    }
  }

  return findings;
}
