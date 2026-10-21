export interface UserPlan {
  id: string;
  name: string;
  scope: string;
  isPredefined: boolean;
  monthlyAllowance: number;
  maxPerRequest: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRow {
  externalUserId: string;
  createdAt: Date;
  userPlan: UserPlan;
}
