interface Gate {
  active: number;
  waiters: Array<() => void>;
}

const gates = new Map<string, Gate>();

export class OverloadedError extends Error {
  constructor(key: string) {
    super(`Too many requests are already waiting for ${key}`);
    this.name = 'OverloadedError';
  }
}

export const runLimited = async <T>(
  key: string,
  limit: number,
  job: () => Promise<T>,
  maxWaiting = Number.POSITIVE_INFINITY,
): Promise<T> => {
  let gate = gates.get(key);
  if (!gate) {
    gate = { active: 0, waiters: [] };
    gates.set(key, gate);
  }
  if (gate.active >= limit) {
    if (gate.waiters.length >= maxWaiting) throw new OverloadedError(key);
    const g = gate;

    await new Promise<void>((resolve) => g.waiters.push(resolve));
  } else {
    gate.active++;
  }
  try {
    return await job();
  } finally {
    const next = gate.waiters.shift();
    if (next) {
      next();
    } else {
      gate.active--;
      if (gate.active === 0) gates.delete(key);
    }
  }
};

export const activeGateCount = (): number => gates.size;
