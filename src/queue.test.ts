import { describe, it, expect } from 'vitest';
import { parseQueueFile, stringToStep, listPlaybookFiles, findFirstExisting } from './queue';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'queue-'));
}

describe('stringToStep', () => {
  it('трактует .yml как плейбук', () => {
    const s = stringToStep('deploy.yml', '/proj');
    expect(s?.isPlaybook).toBe(true);
    expect(s?.command).toBe('/proj/deploy.yml');
  });

  it('оставляет команду как есть', () => {
    const s = stringToStep('ansible-playbook deploy.yml', '/proj');
    expect(s?.isPlaybook).toBeUndefined();
    expect(s?.command).toBe('ansible-playbook deploy.yml');
  });

  it('игнорирует пустую строку', () => {
    expect(stringToStep('   ', '/proj')).toBeNull();
  });
});

describe('parseQueueFile', () => {
  it('разбирает commands с name+run', () => {
    const dir = tmpdir();
    const file = path.join(dir, 'run-queue.yml');
    fs.writeFileSync(
      file,
      'commands:\n  - name: Шаг один\n    run: ansible-playbook deps.yml\n  - name: Деплой\n    playbook: deploy.yml\n',
    );
    const steps = parseQueueFile(file, dir);
    expect(steps).toHaveLength(2);
    expect(steps[0]?.title).toBe('Шаг один');
    expect(steps[0]?.command).toBe('ansible-playbook deps.yml');
    expect(steps[1]?.isPlaybook).toBe(true);
    expect(steps[1]?.command).toBe(path.join(dir, 'deploy.yml'));
  });

  it('разбирает плоский список строк', () => {
    const dir = tmpdir();
    const file = path.join(dir, 'run-queue.yml');
    fs.writeFileSync(file, '- deps.yml\n- deploy.yml\n');
    const steps = parseQueueFile(file, dir);
    expect(steps).toHaveLength(2);
    expect(steps.every((s) => s.isPlaybook)).toBe(true);
  });

  it('возвращает [] для битого файла', () => {
    const dir = tmpdir();
    const file = path.join(dir, 'run-queue.yml');
    fs.writeFileSync(file, ': : : not yaml\n\tbad');
    expect(parseQueueFile(file, dir)).toEqual([]);
  });
});

describe('listPlaybookFiles', () => {
  it('пропускает requirements и run-queue', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'site.yml'), '');
    fs.writeFileSync(path.join(dir, 'deploy.yaml'), '');
    fs.writeFileSync(path.join(dir, 'requirements.yml'), '');
    fs.writeFileSync(path.join(dir, 'run-queue.yml'), '');
    const files = listPlaybookFiles(dir);
    expect(files).toEqual(['deploy.yaml', 'site.yml']);
  });
});

describe('findFirstExisting', () => {
  it('возвращает первый существующий', () => {
    const dir = tmpdir();
    const a = path.join(dir, 'a.txt');
    fs.writeFileSync(a, '');
    expect(findFirstExisting([path.join(dir, 'nope'), a])).toBe(a);
    expect(findFirstExisting([path.join(dir, 'nope')])).toBeNull();
  });
});
