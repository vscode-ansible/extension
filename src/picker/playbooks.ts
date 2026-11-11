import * as path from 'node:path';
import { listPlaybookFiles, isPlaybookFile } from '../queue';

export interface SelectablePlaybook {
  fsPath: string;
  label: string;
}

/**
 * Lists playbooks that are actual playbooks (list of plays), not var/queue
 * files. Relies on `isPlaybookFile` (content-aware) to exclude mappings like
 * requirements.yml.
 */
export function listSelectablePlaybooks(root: string): SelectablePlaybook[] {
  return listPlaybookFiles(root)
    .filter((f) => isPlaybookFile(path.join(root, f)))
    .map((f) => ({ fsPath: path.join(root, f), label: f }));
}

/** Resolves a label (basename) back to a file path, or undefined if missing. */
export function resolvePlaybookByLabel(root: string, label: string): string | undefined {
  const found = listSelectablePlaybooks(root).find((p) => p.label === label);
  return found?.fsPath;
}
