import { SECRET_PATTERNS } from './types';
import type { SecretFinding } from './types';

export interface ProjectFileRef {
  path: string;
  isVault?: boolean;
  content: string;
}

/**
 * Scans project file contents for plain-text secrets:
 * AWS access keys, private keys, and key=value assignments with secret keys.
 * Returns findings with positions for highlighting in the editor.
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
      findings.push({ message: 'AWS access key detected', line: i, start: 0, end: lineText.length });
    }
    if (SECRET_PATTERNS.privateKeyBlock.test(lineText)) {
      findings.push({ message: 'Private key detected', line: i, start: 0, end: lineText.length });
    }

    const m = lineText.match(SECRET_PATTERNS.keyValueAssignment);
    if (m) {
      const start = m.index ?? 0;
      findings.push({
        message: `Potential plain-text secret (${m[1]}=...)`,
        line: i,
        start,
        end: start + m[0].length,
      });
    }
  }

  return findings;
}
