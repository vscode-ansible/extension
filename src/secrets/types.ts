export type FindingType = 'duplicate' | 'unused' | 'expired' | 'leaked';

export interface SecretFinding {
  type: FindingType;
  name: string;
  message: string;
}

export interface ScanSecretsOptions {
  unusedDays?: number;
  rotationDays?: number;
  now?: number;
}

export const SECRET_PATTERNS = {
  awsAccessKey: /AKIA[0-9A-Z]{16}/,
  privateKeyBlock: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  keyValueAssignment:
    /(?:^|[^A-Za-z0-9_])([A-Za-z0-9_]*(?:password|passwd|secret|[Aa]pi[_-]?key|token|client_secret|access_token)[A-Za-z0-9_]*)\s*[:=]\s*['"]?([^\s'"$]+)/i,
  ansibleVaultHeader: /^\$ANSIBLE_VAULT;/m,
} as const;
