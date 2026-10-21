export type Plan = {
  id: string;
  name: string;
  scope: 'ACCOUNT' | 'USER';
  isPredefined: boolean;
  monthlyAllowance: number;
  maxPerRequest: number;
};

export type Level = {
  planId: string;
  planName: string;
  monthlyAllowance: number;
  maxPerRequest: number;
  consumed: number;
  remaining: number;
};

export type Account = { id: string; name: string; accountPlan: Plan; createdAt: string };
export type User = { userRef: string; plan: Plan; createdAt: string };
export type Usage = { month: string; account: Level; users: (Level & { userRef: string })[]; nextCursor?: string | null };
export type Violation = { level: string; rule: string; limit: number; attempted: number };
export type ConsumeResult = {
  requestId: string;
  userRef: string;
  units: number;
  accepted: boolean;
  replayed: boolean;
  reason: Violation | null;
  violations: Violation[];
  month: string;
  processedAt: string;
  account: Level;
  user: Level;
};
export type HistoryItem = ConsumeResult & { outcome: 'ACCEPTED' | 'REJECTED' };
export type Tab = 'Overview' | 'Users' | 'Plans' | 'Demo' | 'Simulator' | 'History' | 'Insights';
export type DemoRow = { label: string; result?: ConsumeResult; note?: string };
