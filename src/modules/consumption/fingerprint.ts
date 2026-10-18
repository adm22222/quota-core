import crypto from 'crypto';

export const createFingerprint = (userRef: string, units: number): string => {
  const input = JSON.stringify([userRef, units]);

  return crypto.createHash('sha256').update(input).digest('hex');
};
