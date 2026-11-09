import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { RunStep } from './runner';

/** Находит первый существующий файл из списка. */
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
 * Разбирает `run-queue.yml` в список шагов. Поддерживает формы:
 *   commands:
 *     - name: Установка зависимостей
 *       run: ansible-playbook deps.yml
 *     - name: Деплой
 *       playbook: deploy.yml
 *     - echo 'hello'            # строка-команда как единичный элемент списка
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

/** Превращает одну строку из очереди в шаг (по расширению определяется тип). */
export function stringToStep(raw: string, root: string): RunStep | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Плейбук — только одиночное имя файла .yml без пробелов (иначе это команда).
  if (/^[^\s]+\.[yY][aA]?[mM][lL]$/.test(trimmed)) {
    const full = path.isAbsolute(trimmed) ? trimmed : path.join(root, trimmed);
    return { title: trimmed, command: full, isPlaybook: true };
  }
  return { title: trimmed, command: trimmed };
}

/** Перечисляет файлы .yml/.yaml в корне, кроме служебных. */
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
