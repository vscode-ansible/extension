import { describe, it, expect } from 'vitest';
import { findSecretLeaks } from './pure';

describe('findSecretLeaks', () => {
  it('detects an AWS access key', () => {
    const leaks = findSecretLeaks('aws_access_key: AKIAIOSFODNN7EXAMPLE\n');
    expect(leaks.some((l) => l.message.includes('AWS access key'))).toBe(true);
  });

  it('detects a private key', () => {
    const leaks = findSecretLeaks('-----BEGIN RSA PRIVATE KEY-----\nxyz\n-----END RSA PRIVATE KEY-----\n');
    expect(leaks.some((l) => l.message.includes('Private key'))).toBe(true);
  });

  it('detects a key=value assignment with a secret key', () => {
    const leaks = findSecretLeaks('db_password: s3cretValue\n');
    expect(leaks.some((l) => l.message.includes('password'))).toBe(true);
  });

  it('does not false-positive on ordinary variables', () => {
    const leaks = findSecretLeaks('hostname: webserver\ncount: 42\n');
    expect(leaks).toHaveLength(0);
  });

  it('skips an encrypted vault', () => {
    const vault = '$ANSIBLE_VAULT;1.1;AES256\n66386439653236336462...\n';
    const leaks = findSecretLeaks(vault);
    expect(leaks.filter((l) => l.message.includes('secret'))).toHaveLength(0);
  });
});
