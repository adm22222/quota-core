import crypto from 'crypto';
export const generateApiKey = () => {
  const randomApiKey = crypto.randomBytes(32).toString('hex');
  return `qtc_${randomApiKey}`;
};

export const hashApiKey = (apiKey: string) =>
  crypto.createHash('sha256').update(apiKey).digest('hex');
