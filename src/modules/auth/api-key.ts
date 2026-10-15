import crypto from 'crypto';

const API_KEY_PREFIX = 'qtc_';

export const generateApiKey = () => {
  const randomApiKey = crypto.randomBytes(32).toString('hex');
  return `${API_KEY_PREFIX}${randomApiKey}`;
};

export const hashApiKey = (apiKey: string) =>
  crypto.createHash('sha256').update(apiKey).digest('hex');

export const getApiKeyPrefix = (apiKey: string): string => {
  return `${API_KEY_PREFIX}${apiKey.slice(API_KEY_PREFIX.length, API_KEY_PREFIX.length + 8)}`;
};
