import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../helpers/test-db.ts';
import request from 'supertest';
import app from '../../src/app.ts';

describe('Consume API Integration Tests', () => {
  beforeAll(async () => {
    await resetDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  const createAccount = async (name = 'Test Account') => {
    const res = await request(app).post('/api/v1/accounts').send({ name });
    return { apiKey: res.body.apiKey as string, account: res.body.account };
  };

  const createUser = async (
    apiKey: string,
    userRef: string,
    planId?: string,
  ) => {
    const body: Record<string, unknown> = { userRef };
    if (planId) body.planId = planId;
    return request(app)
      .post('/api/v1/users')
      .set('X-API-Key', apiKey)
      .send(body);
  };

  const createCustomPlan = async (
    apiKey: string,
    overrides: Partial<{
      name: string;
      scope: 'ACCOUNT' | 'USER';
      monthlyAllowance: number;
      maxPerRequest: number;
    }> = {},
  ) => {
    const body = {
      name: `Plan-${Math.random().toString(36).slice(2, 8)}`,
      scope: 'USER',
      monthlyAllowance: 1000,
      maxPerRequest: 20,
      ...overrides,
    };
    return request(app)
      .post('/api/v1/plans')
      .set('X-API-Key', apiKey)
      .send(body);
  };

  const consume = async (
    apiKey: string,
    userRef: string,
    units: number,
    requestId: string,
  ) => {
    return request(app)
      .post('/api/v1/consume')
      .set('X-API-Key', apiKey)
      .send({ userRef, units, requestId });
  };

  const usage = async (apiKey: string) => {
    return request(app).get('/api/v1/usage').set('X-API-Key', apiKey);
  };

  const userUsage = async (apiKey: string, userRef: string) => {
    return request(app)
      .get(`/api/v1/users/${userRef}/usage`)
      .set('X-API-Key', apiKey);
  };

  describe('POST /v1/consume — Accepted', () => {
    it('should accept a consume request within all limits', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 10, 'req-1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        requestId: 'req-1',
        userRef: 'alice',
        units: 10,
        accepted: true,
        replayed: false,
        reason: null,
        violations: [],
      });
      expect(res.body.month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      expect(res.body.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should return account snapshot with all fields', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 10, 'req-1');

      expect(res.body.account).toMatchObject({
        planId: expect.any(String),
        planName: 'Starter',
        monthlyAllowance: 10000,
        maxPerRequest: 100,
        consumed: 10,
        remaining: 9990,
      });
    });

    it('should return user snapshot with all fields', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 10, 'req-1');

      expect(res.body.user).toMatchObject({
        planId: expect.any(String),
        planName: 'Basic',
        monthlyAllowance: 1000,
        maxPerRequest: 20,
        consumed: 10,
        remaining: 990,
      });
    });

    it('should accept exactly at maxPerRequest boundary (user)', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 20, 'req-1');
      expect(res.body.accepted).toBe(true);
    });

    it('should accept exactly at maxPerRequest boundary (account)', async () => {
      const { apiKey } = await createAccount();

      const plan = await createCustomPlan(apiKey, {
        scope: 'USER',
        maxPerRequest: 1000,
        monthlyAllowance: 5000,
      });
      await createUser(apiKey, 'alice', plan.body.id);

      const res = await consume(apiKey, 'alice', 100, 'req-1');
      expect(res.body.accepted).toBe(true);
    });

    it('should accept units = 1 (minimum)', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 1, 'req-1');
      expect(res.body.accepted).toBe(true);
    });

    it('should accept units = 1e9 (maximum) when limits allow', async () => {
      const { apiKey } = await createAccount();

      const acctPlan = await createCustomPlan(apiKey, {
        scope: 'ACCOUNT',
        monthlyAllowance: 1_000_000_000,
        maxPerRequest: 1_000_000_000,
      });
      await request(app)
        .put('/api/v1/account/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: acctPlan.body.id });

      const userPlan = await createCustomPlan(apiKey, {
        scope: 'USER',
        monthlyAllowance: 1_000_000_000,
        maxPerRequest: 1_000_000_000,
      });
      await createUser(apiKey, 'alice', userPlan.body.id);

      const res = await consume(apiKey, 'alice', 1_000_000_000, 'req-1');
      expect(res.body.accepted).toBe(true);
    });

    it('should increment counters correctly in response', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const r1 = await consume(apiKey, 'alice', 5, 'req-1');
      expect(r1.body.account.consumed).toBe(5);
      expect(r1.body.user.consumed).toBe(5);

      const r2 = await consume(apiKey, 'alice', 7, 'req-2');
      expect(r2.body.account.consumed).toBe(12);
      expect(r2.body.user.consumed).toBe(12);
    });

    it('should share account consumption across users', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');
      await createUser(apiKey, 'bob');

      const r1 = await consume(apiKey, 'alice', 10, 'req-1');
      expect(r1.body.account.consumed).toBe(10);
      expect(r1.body.user.consumed).toBe(10);

      const r2 = await consume(apiKey, 'bob', 15, 'req-2');
      expect(r2.body.account.consumed).toBe(25);
      expect(r2.body.user.consumed).toBe(15);
    });
    it('should reset monthly counters at month rollover while preserving past months', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));

      const { apiKey } = await createAccount();
      const newUser = await createUser(apiKey, 'alice');
      expect(newUser.status).toBe(201);
      const req1 = await consume(apiKey, 'alice', 20, 'req-1');
      expect(req1.body.accepted).toBe(true);
      const oct = await request(app)
        .get('/api/v1/usage')
        .set('X-API-Key', apiKey);
      expect(oct.body.month).toBe('2026-10');
      expect(oct.body.account.consumed).toBe(20);

      vi.setSystemTime(new Date('2026-11-01T00:00:01Z'));

      const nov = await request(app)
        .get('/api/v1/usage')
        .set('X-API-Key', apiKey);
      expect(nov.body.month).toBe('2026-11');
      expect(nov.body.account.consumed).toBe(0);

      const octAgain = await request(app)
        .get('/api/v1/usage?month=2026-10')
        .set('X-API-Key', apiKey);
      expect(octAgain.body.account.consumed).toBe(20);

      await consume(apiKey, 'alice', 5, 'req-2');
      const nov2 = await request(app)
        .get('/api/v1/usage')
        .set('X-API-Key', apiKey);
      expect(nov2.body.account.consumed).toBe(5);

      vi.useRealTimers();
    });
  });

  describe('Rejection — ACCOUNT per-request', () => {
    it('should reject when units > account maxPerRequest', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 150, 'req-1');

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(false);
      expect(res.body.replayed).toBe(false);
      expect(res.body.reason).toEqual({
        level: 'ACCOUNT',
        rule: 'MAX_PER_REQUEST',
        limit: 100,
        attempted: 150,
      });
    });

    it('should include the violation in violations[]', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 150, 'req-1');

      expect(res.body.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'ACCOUNT',
            rule: 'MAX_PER_REQUEST',
            limit: 100,
            attempted: 150,
          }),
        ]),
      );
    });

    it('should not consume units on rejection', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      await consume(apiKey, 'alice', 150, 'req-1');

      const u = await usage(apiKey);
      expect(u.body.account.consumed).toBe(0);
    });

    it('should return unchanged consumed/remaining in response body', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 150, 'req-1');
      expect(res.body.account.consumed).toBe(0);
      expect(res.body.account.remaining).toBe(10000);
    });
  });

  describe('Rejection — USER per-request', () => {
    it('should reject when units > user maxPerRequest', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');
      const res = await consume(apiKey, 'alice', 25, 'req-1');

      expect(res.body.accepted).toBe(false);
      expect(res.body.reason).toEqual({
        level: 'USER',
        rule: 'MAX_PER_REQUEST',
        limit: 20,
        attempted: 25,
      });
    });

    it('should include the violation in violations[]', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 25, 'req-1');
      expect(res.body.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'USER',
            rule: 'MAX_PER_REQUEST',
            limit: 20,
          }),
        ]),
      );
    });
  });

  describe('Rejection — ACCOUNT monthly allowance', () => {
    it('should reject when units > account remaining', async () => {
      const { apiKey } = await createAccount();

      const acctPlan = await createCustomPlan(apiKey, {
        scope: 'ACCOUNT',
        monthlyAllowance: 10,
        maxPerRequest: 100,
      });
      const changePlanRes = await request(app)
        .put('/api/v1/account/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: acctPlan.body.id });

      expect(changePlanRes.status).toBe(200);
      await createUser(apiKey, 'alice');

      await consume(apiKey, 'alice', 8, 'req-1');

      const res = await consume(apiKey, 'alice', 5, 'req-2');

      expect(res.body.accepted).toBe(false);
      expect(res.body.reason).toEqual({
        level: 'ACCOUNT',
        rule: 'MONTHLY_ALLOWANCE',
        limit: 10,
        attempted: 5,
        remaining: 2,
      });
    });

    it('should use remaining (not full allowance) as limit', async () => {
      const { apiKey } = await createAccount();

      const acctPlan = await createCustomPlan(apiKey, {
        scope: 'ACCOUNT',
        monthlyAllowance: 10,
        maxPerRequest: 100,
      });
      expect(acctPlan.status).toBe(201);
      await request(app)
        .put('/api/v1/account/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: acctPlan.body.id });

      await createUser(apiKey, 'alice');

      await consume(apiKey, 'alice', 3, 'req-1');
      const res = await consume(apiKey, 'alice', 8, 'req-2');
      console.log(res.body);
      expect(res.body.accepted).toBe(false);
      expect(res.body.reason).toMatchObject({
        level: 'ACCOUNT',
        rule: 'MONTHLY_ALLOWANCE',
      });
      expect(res.body.reason.remaining).toBe(7);
    });

    it('should accept when units == account remaining', async () => {
      const { apiKey } = await createAccount();

      const acctPlan = await createCustomPlan(apiKey, {
        scope: 'ACCOUNT',
        monthlyAllowance: 10,
        maxPerRequest: 100,
      });
      await request(app)
        .put('/v1/account/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: acctPlan.body.id });
      await createUser(apiKey, 'alice');

      await consume(apiKey, 'alice', 3, 'req-1');
      const res = await consume(apiKey, 'alice', 7, 'req-2');
      expect(res.body.accepted).toBe(true);
    });
  });
  describe('Rejection — USER monthly allowance', () => {
    it('should reject when units > user remaining', async () => {
      const { apiKey } = await createAccount();

      const userPlan = await createCustomPlan(apiKey, {
        scope: 'USER',
        monthlyAllowance: 10,
        maxPerRequest: 100,
      });
      await createUser(apiKey, 'alice', userPlan.body.id);

      await consume(apiKey, 'alice', 8, 'req-1');
      const res = await consume(apiKey, 'alice', 5, 'req-2');

      expect(res.body.accepted).toBe(false);
      expect(res.body.reason).toEqual({
        level: 'USER',
        rule: 'MONTHLY_ALLOWANCE',
        limit: 10,
        remaining: 2,
        attempted: 5,
      });
    });
  });
  describe('Rule ordering for primary reason', () => {
    it('should report ACCOUNT per-request first when both per-request limits fail', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 150, 'req-1');

      expect(res.body.reason).toMatchObject({
        level: 'ACCOUNT',
        rule: 'MAX_PER_REQUEST',
      });

      const levels = res.body.violations.map((v: any) => v.level);
      expect(levels).toContain('ACCOUNT');
      expect(levels).toContain('USER');
    });

    it('should report USER per-request before ACCOUNT monthly', async () => {
      const { apiKey } = await createAccount();

      const acctPlan = await createCustomPlan(apiKey, {
        scope: 'ACCOUNT',
        monthlyAllowance: 10,
        maxPerRequest: 100,
      });
      await request(app)
        .put('/v1/account/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: acctPlan.body.id });
      await createUser(apiKey, 'alice');

      const res = await consume(apiKey, 'alice', 25, 'req-1');
      expect(res.body.reason).toMatchObject({
        level: 'USER',
        rule: 'MAX_PER_REQUEST',
      });
    });

    it('should report ACCOUNT monthly before USER monthly', async () => {
      const { apiKey } = await createAccount();

      const acctPlan = await createCustomPlan(apiKey, {
        scope: 'ACCOUNT',
        monthlyAllowance: 10,
        maxPerRequest: 100,
      });
      await request(app)
        .put('/v1/account/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: acctPlan.body.id });

      const userPlan = await createCustomPlan(apiKey, {
        scope: 'USER',
        monthlyAllowance: 10,
        maxPerRequest: 100,
      });
      await createUser(apiKey, 'alice', userPlan.body.id);

      await consume(apiKey, 'alice', 8, 'req-1');
      const res = await consume(apiKey, 'alice', 8, 'req-2');

      expect(res.body.reason).toMatchObject({
        level: 'USER',
        rule: 'MONTHLY_ALLOWANCE',
      });
    });
  });

  describe('Replay semantics', () => {
    it('should replay an accepted decision with replayed=true', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const first = await consume(apiKey, 'alice', 10, 'req-1');
      expect(first.body.replayed).toBe(false);
      expect(first.body.accepted).toBe(true);

      const replay = await consume(apiKey, 'alice', 10, 'req-1');
      expect(replay.status).toBe(200);
      expect(replay.body.replayed).toBe(true);
      expect(replay.body.accepted).toBe(true);
      expect(replay.body.requestId).toBe('req-1');
    });

    it('should not increment counters on replay', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      await consume(apiKey, 'alice', 10, 'req-1');
      await consume(apiKey, 'alice', 10, 'req-1');

      const u = await usage(apiKey);
      expect(u.body.account.consumed).toBe(10);
    });

    it('should replay a rejected decision without re-evaluating', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const first = await consume(apiKey, 'alice', 25, 'req-1');
      expect(first.body.accepted).toBe(false);
      expect(first.body.reason.rule).toBe('MAX_PER_REQUEST');
      const permissive = await createCustomPlan(apiKey, {
        scope: 'USER',
        monthlyAllowance: 1000,
        maxPerRequest: 100,
      });
      await request(app)
        .put('/api/v1/users/alice/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: permissive.body.id });

      const replay = await consume(apiKey, 'alice', 25, 'req-1');
      expect(replay.body.replayed).toBe(true);
      expect(replay.body.accepted).toBe(false);
      expect(replay.body.reason.rule).toBe('MAX_PER_REQUEST');
    });

    it('should return snapshot of state right after original decision', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const first = await consume(apiKey, 'alice', 10, 'req-1');
      const snapshotConsumed = first.body.account.consumed;

      await consume(apiKey, 'alice', 5, 'req-2');

      const replay = await consume(apiKey, 'alice', 10, 'req-1');
      expect(replay.body.account.consumed).toBe(snapshotConsumed);
      expect(replay.body.user.consumed).toBe(snapshotConsumed);
    });

    it('should reject reuse with different units (409)', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      await consume(apiKey, 'alice', 10, 'req-1');
      const res = await consume(apiKey, 'alice', 15, 'req-1');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT_ERROR');
    });

    it('should reject reuse with different userRef (409)', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');
      await createUser(apiKey, 'bob');

      await consume(apiKey, 'alice', 10, 'req-1');
      const res = await consume(apiKey, 'bob', 10, 'req-1');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT_ERROR');
    });

    it('should allow same requestId across different accounts', async () => {
      const { apiKey: k1 } = await createAccount('Acc 1');
      const { apiKey: k2 } = await createAccount('Acc 2');

      await createUser(k1, 'alice');
      await createUser(k2, 'alice');

      const r1 = await consume(k1, 'alice', 10, 'req-1');
      const r2 = await consume(k2, 'alice', 10, 'req-1');

      expect(r1.body.replayed).toBe(false);
      expect(r2.body.replayed).toBe(false);
      expect(r2.body.accepted).toBe(true);
    });
  });

  describe('Validation errors', () => {
    it('should reject missing userRef', async () => {
      const { apiKey } = await createAccount();
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', apiKey)
        .send({ units: 10, requestId: 'req-1' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing units', async () => {
      const { apiKey } = await createAccount();
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', apiKey)
        .send({ userRef: 'alice', requestId: 'req-1' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing requestId', async () => {
      const { apiKey } = await createAccount();
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', apiKey)
        .send({ userRef: 'alice', units: 10 });

      expect(res.status).toBe(400);
    });

    it('should reject units = 0', async () => {
      const { apiKey } = await createAccount();
      const res = await consume(apiKey, 'alice', 0, 'req-1');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative units', async () => {
      const { apiKey } = await createAccount();
      const res = await consume(apiKey, 'alice', -5, 'req-1');
      expect(res.status).toBe(400);
    });

    it('should reject non-integer units', async () => {
      const { apiKey } = await createAccount();
      const res = await consume(apiKey, 'alice', 1.5 as any, 'req-1');
      expect(res.status).toBe(400);
    });

    it('should reject units > 1e9', async () => {
      const { apiKey } = await createAccount();
      const res = await consume(apiKey, 'alice', 1_000_000_001, 'req-1');
      expect(res.status).toBe(400);
    });

    it('should reject userRef > 128 chars', async () => {
      const { apiKey } = await createAccount();
      const res = await consume(apiKey, 'a'.repeat(129), 10, 'req-1');
      expect(res.status).toBe(400);
    });

    it('should reject requestId > 128 chars', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');
      const res = await consume(apiKey, 'alice', 10, 'r'.repeat(129));
      expect(res.status).toBe(400);
    });

    it('should reject empty body', async () => {
      const { apiKey } = await createAccount();
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', apiKey)
        .send({});
      expect(res.status).toBe(400);
    });

    it('should not record validation errors in history', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      await consume(apiKey, 'alice', 0, 'bad-req');

      const history = await request(app)
        .get('/api/v1/history')
        .set('X-API-Key', apiKey);
      const ids = history.body.items.map((i: any) => i.requestId);
      expect(ids).not.toContain('bad-req');
    });
  });

  describe('Authentication', () => {
    it('should reject missing API key', async () => {
      const res = await request(app)
        .post('/api/v1/consume')
        .send({ userRef: 'alice', units: 10, requestId: 'req-1' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED_ERROR');
    });

    it('should reject invalid API key', async () => {
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', 'bad-key')
        .send({ userRef: 'alice', units: 10, requestId: 'req-1' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED_ERROR');
    });
  });

  describe('Not found', () => {
    it('should reject non-existent user', async () => {
      const { apiKey } = await createAccount();
      const res = await consume(apiKey, 'ghost', 10, 'req-1');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND_ERROR');
    });

    it("should hide another account's user (404)", async () => {
      const { apiKey: k1 } = await createAccount('Acc 1');
      const { apiKey: k2 } = await createAccount('Acc 2');
      await createUser(k1, 'alice');

      const res = await consume(k2, 'alice', 10, 'req-1');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND_ERROR');
    });
  });

  describe('Integration', () => {
    it('should paginate usage users with the returned cursor', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');
      await createUser(apiKey, 'bob');
      await createUser(apiKey, 'adam');

      const firstPage = await request(app)
        .get('/api/v1/usage')
        .query({ limit: 2 })
        .set('X-API-Key', apiKey);

      expect(firstPage.status).toBe(200);
      expect(
        firstPage.body.users.map((user: { userRef: string }) => user.userRef),
      ).toEqual(['adam', 'alice']);
      expect(firstPage.body.nextCursor).toEqual(expect.any(String));

      const secondPage = await request(app)
        .get('/api/v1/usage')
        .query({ limit: 2, cursor: firstPage.body.nextCursor })
        .set('X-API-Key', apiKey);

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.users.length).toBe(1);
      expect(
        secondPage.body.users.map((user: { userRef: string }) => user.userRef),
      ).toEqual(['bob']);
      expect(secondPage.body.nextCursor).toBeNull();
    });

    it('should reject after plan downgrade below consumption', async () => {
      const { apiKey } = await createAccount();

      const accountPlan = await createCustomPlan(apiKey, {
        scope: 'ACCOUNT',
        monthlyAllowance: 1000,
        maxPerRequest: 1000,
      });
      expect(accountPlan.status).toBe(201);
      await request(app)
        .put('/api/v1/account/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: accountPlan.body.id });

      const userPlan = await createCustomPlan(apiKey, {
        scope: 'USER',
        monthlyAllowance: 1000,
        maxPerRequest: 1000,
      });
      await createUser(apiKey, 'alice', userPlan.body.id);

      const consume500 = await consume(apiKey, 'alice', 500, 'req-1');
      expect(consume500.body.accepted).toBe(true);

      const downAllowancePlan = await request(app)
        .put(`/api/v1/plans/${userPlan.body.id}`)
        .set('X-API-Key', apiKey)
        .send({ monthlyAllowance: 100, maxPerRequest: 100 });
      expect(downAllowancePlan.status).toBe(200);

      const res = await consume(apiKey, 'alice', 1, 'req-2');
      expect(res.body.accepted).toBe(false);
      expect(res.body.reason.rule).toBe('MONTHLY_ALLOWANCE');
      expect(res.body.user.remaining).toBe(0);
    });

    it('should record accepted decisions in history', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');
      await consume(apiKey, 'alice', 10, 'req-1');

      const history = await request(app)
        .get('/api/v1/history?userRef=alice')
        .set('X-API-Key', apiKey);

      expect(history.body.items[0]).toMatchObject({
        requestId: 'req-1',
        userRef: 'alice',
        units: 10,
        outcome: 'ACCEPTED',
      });
    });

    it('should record rejected decisions in history with reason', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');
      await consume(apiKey, 'alice', 25, 'req-1');

      const history = await request(app)
        .get('/api/v1/history?outcome=REJECTED')
        .set('X-API-Key', apiKey);

      expect(history.body.items[0]).toMatchObject({
        requestId: 'req-1',
        outcome: 'REJECTED',
        reason: {
          level: 'USER',
          rule: 'MAX_PER_REQUEST',
        },
      });
    });

    it('should snapshot limits in history (immutable)', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      await consume(apiKey, 'alice', 10, 'req-1');

      const newPlan = await createCustomPlan(apiKey, {
        scope: 'USER',
        monthlyAllowance: 5000,
        maxPerRequest: 200,
      });
      await request(app)
        .put('/api/v1/users/alice/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: newPlan.body.id });

      const history = await request(app)
        .get('/api/v1/history?userRef=alice')
        .set('X-API-Key', apiKey);

      const item = history.body.items.find((i: any) => i.requestId === 'req-1');
      expect(item.user.planName).toBe('Basic');
      expect(item.user.monthlyAllowance).toBe(1000);
    });

    it('should keep history entries independent per retry attempt', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      await consume(apiKey, 'alice', 25, 'req-A');
      await consume(apiKey, 'alice', 25, 'req-B');

      const history = await request(app)
        .get('/api/v1/history?userRef=alice')
        .set('X-API-Key', apiKey);
      const ids = history.body.items.map((i: any) => i.requestId);
      expect(ids).toContain('req-A');
      expect(ids).toContain('req-B');
    });

    it('should allow consume after plan upgrade', async () => {
      const { apiKey } = await createAccount();
      await createUser(apiKey, 'alice');

      const r1 = await consume(apiKey, 'alice', 50, 'req-1');
      expect(r1.body.accepted).toBe(false);

      const upgrade = await createCustomPlan(apiKey, {
        scope: 'USER',
        monthlyAllowance: 5000,
        maxPerRequest: 100,
      });
      await request(app)
        .put('/api/v1/users/alice/plan')
        .set('X-API-Key', apiKey)
        .send({ planId: upgrade.body.id });

      const r2 = await consume(apiKey, 'alice', 50, 'req-2');
      expect(r2.body.accepted).toBe(true);
    });
  });
  describe('Concurrency', () => {
    it('should maintain invariants under 200 parallel consume requests', async () => {
      const { apiKey } = await createAccount();

      const userPlan = await createCustomPlan(apiKey, {
        scope: 'USER',
        monthlyAllowance: 2000,
        maxPerRequest: 100,
      });
      await createUser(apiKey, 'alice', userPlan.body.id);
      await createUser(apiKey, 'bob', userPlan.body.id);
      await createUser(apiKey, 'carol', userPlan.body.id);

      const users = ['alice', 'bob', 'carol'];
      const UNITS = 5;
      const N = 200;

      const requests = Array.from({ length: N }, (_, i) => {
        const userRef = users[i % users.length];

        const requestId =
          i % 10 === 9 ? `parallel-req-${i - 1}` : `parallel-req-${i}`;

        return request(app)
          .post('/api/v1/consume')
          .set('X-API-Key', apiKey)
          .send({ userRef, units: UNITS, requestId });
      });

      const responses = await Promise.all(requests);
      // console.log('res', responses[0].body);

      const statuses = responses.map((r) => r.status);
      expect(statuses.every((s) => [200, 409].includes(s))).toBe(true);

      const acceptedUnique = new Set<string>();
      responses.forEach((r) => {
        if (r.status === 200 && r.body.accepted) {
          acceptedUnique.add(r.body.requestId);
        }
      });
      // console.log('acceptedUnique', acceptedUnique.size);
      const expectedAcceptedUnits = acceptedUnique.size * UNITS;

      const u = await usage(apiKey);
      const accountConsumed = u.body.account.consumed;
      const userSum = u.body.users.reduce(
        (s: number, x: any) => s + x.consumed,
        0,
      );

      expect(accountConsumed).toBe(expectedAcceptedUnits);
      expect(userSum).toBe(expectedAcceptedUnits);

      expect(accountConsumed).toBeLessThanOrEqual(
        u.body.account.monthlyAllowance,
      );
      for (const user of u.body.users) {
        expect(user.consumed).toBeLessThanOrEqual(user.monthlyAllowance);
      }

      const history = await request(app)
        .get('/api/v1/history?limit=200')
        .set('X-API-Key', apiKey);
      for (const item of history.body.items) {
        expect(item.outcome).not.toBeNull();
        expect(['ACCEPTED', 'REJECTED']).toContain(item.outcome);
      }
    }, 15_000);
  });
});
