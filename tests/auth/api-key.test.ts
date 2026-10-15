import { describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey } from '../../src/modules/auth/api-key.ts';

describe('ApiKey test', () => {
  it('generate api key', () => {
    const apiKey = generateApiKey();
    console.log('Generated API Key:', apiKey);
    expect(apiKey).toHaveLength(68);
  });
  it('generate multiple api keys and ensure uniqueness', () => {
    const apiKeys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const apiKey = generateApiKey();
      expect(apiKeys.has(apiKey)).toBe(false);
      apiKeys.add(apiKey);
    }
  });
  it('generate api key and hash it', () => {
    const apiKey = generateApiKey();
    const hashedApiKey = hashApiKey(apiKey);

    expect(hashedApiKey).toHaveLength(64);
  });
  it('generate api key with correct prefix', () => {
    const apiKey = generateApiKey();
    expect(apiKey.startsWith('qtc_')).toBe(true);
  });

  it('generate same hash for same api key', () => {
    const apiKey = generateApiKey();
    expect(hashApiKey(apiKey)).toBe(hashApiKey(apiKey));
  });

  it('generate different hash for different api keys', () => {
    const apiKey1 = generateApiKey();
    const apiKey2 = generateApiKey();
    expect(hashApiKey(apiKey1)).not.toBe(hashApiKey(apiKey2));
  });
});
