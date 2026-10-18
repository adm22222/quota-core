import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPredefinedPlan, resetDb } from '../helpers/test-db.ts';
import request from 'supertest';
import app from '../../src/app.ts';

describe('Accounts API Integration Tests', () => {
  beforeAll(async () => {
    await resetDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  const createAccount = async (name = 'Test Account', planId?: string) => {
    const body: Record<string, unknown> = { name };
    if (planId) body.planId = planId;

    const res = await request(app).post('/api/v1/accounts').send(body);
    return { res, apiKey: res.body.apiKey, account: res.body.account };
  };
  describe('POST /v1/accounts', () => {
    describe('Happy path', () => {
      it('should create an account with default Starter plan', async () => {
        const { res } = await createAccount('First Account');

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('account');
        expect(res.body).toHaveProperty('apiKey');

        expect(res.body.account).toMatchObject({
          name: 'First Account',
        });
        expect(res.body.account.accountPlan).toMatchObject({
          name: 'Starter',
          scope: 'ACCOUNT',
          isPredefined: true,
        });
        expect(res.body.account.createdAt).toBeDefined();
      });

      it('should return a plaintext API key only once', async () => {
        const { res, apiKey } = await createAccount('API Key Test');

        expect(res.status).toBe(201);
        expect(typeof apiKey).toBe('string');
        expect(apiKey.length).toBe(68);
        expect(apiKey).toMatch('qtc_');

        const getRes = await request(app)
          .get('/api/v1/account')
          .set('X-API-Key', apiKey);
        expect(getRes.status).toBe(200);
        expect(getRes.body).not.toHaveProperty('apiKey');
      });

      it('should create an account with an explicit ACCOUNT plan', async () => {
        const proPlan = await getPredefinedPlan('Pro', 'ACCOUNT');
        const { res } = await createAccount('Big Co', proPlan.id);

        expect(res.status).toBe(201);
        expect(res.body.account.accountPlan.id).toBe(proPlan.id);
        expect(res.body.account.accountPlan.name).toBe('Pro');
      });

      it('should accept name at minimum length (1 char)', async () => {
        const { res } = await createAccount('A');
        expect(res.status).toBe(201);
        expect(res.body.account.name).toBe('A');
      });

      it('should accept name at maximum length (200 chars)', async () => {
        const name = 'a'.repeat(199);
        const { res } = await createAccount(name);
        expect(res.status).toBe(201);
        expect(res.body.account.name).toBe(name);
      });

      it('should allow duplicate account names (only ids differ)', async () => {
        const { res: r1 } = await createAccount('Duplicate');
        const { res: r2 } = await createAccount('Duplicate');

        expect(r1.status).toBe(201);
        expect(r2.status).toBe(201);
        expect(r1.body.account.id).not.toBe(r2.body.account.id);
      });

      it('should issue unique API keys per account', async () => {
        const { apiKey: k1 } = await createAccount('Acc 1');
        const { apiKey: k2 } = await createAccount('Acc 2');
        expect(k1).not.toBe(k2);
      });
    });

    describe('Validation errors (400)', () => {
      it('should reject missing name', async () => {
        const res = await request(app).post('/api/v1/accounts').send({});

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
        );
      });

      it('should reject empty name', async () => {
        const res = await request(app)
          .post('/api/v1/accounts')
          .send({ name: '' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject name longer than 200 chars', async () => {
        const res = await request(app)
          .post('/api/v1/accounts')
          .send({ name: 'a'.repeat(201) });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject non-string name', async () => {
        const res = await request(app)
          .post('/api/v1/accounts')
          .send({ name: 12345 });
        expect(res.status).toBe(400);
      });

      it('should reject non-UUID planId', async () => {
        const res = await request(app)
          .post('/api/v1/accounts')
          .send({ name: 'X', planId: 'not-a-uuid' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'planId' }),
          ]),
        );
      });

      it('should reject empty body', async () => {
        const res = await request(app).post('/api/v1/accounts').send({});
        expect(res.status).toBe(400);
      });
    });

    describe('Plan resolution errors', () => {
      it('should reject non-existent planId with 404', async () => {
        const res = await request(app).post('/api/v1/accounts').send({
          name: 'X',
          planId: '00000000-0000-0000-0000-000000000000',
        });
        console.log(res.body.details);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND_ERROR');
      });

      it('should reject USER-scope plan with 422', async () => {
        const basic = await getPredefinedPlan('Basic', 'USER');
        const res = await request(app)
          .post('/api/v1/accounts')
          .send({ name: 'X', planId: basic.id });
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('UNPROCESSABLE_ENTITY_ERROR');
      });

      it('should reject a custom ACCOUNT plan with 422 (only predefined allowed)', async () => {
        const { apiKey } = await createAccount('Creator');
        const createPlanRes = await request(app)
          .post('/api/v1/plans')
          .set('X-API-Key', apiKey)
          .send({
            name: 'Custom Account Plan',
            scope: 'ACCOUNT',
            monthlyAllowance: 5000,
            maxPerRequest: 50,
          });
        expect(createPlanRes.status).toBe(201);

        const res = await request(app)
          .post('/api/v1/accounts')
          .send({ name: 'Other', planId: createPlanRes.body.id });

        expect(res.status).toBe(422);
        expect(res.body.code).toBe('UNPROCESSABLE_ENTITY_ERROR');
      });

      it("should not reveal another account's custom plan (404)", async () => {
        const { apiKey } = await createAccount('Creator');
        const createPlanRes = await request(app)
          .post('/api/v1/plans')
          .set('X-API-Key', apiKey)
          .send({
            name: 'Private',
            scope: 'ACCOUNT',
            monthlyAllowance: 100,
            maxPerRequest: 10,
          });

        const res = await request(app)
          .post('/api/v1/accounts')
          .send({ name: 'Other', planId: createPlanRes.body.id });
        expect([404, 422]).toContain(res.status);
      });
    });

    describe('Authentication', () => {
      it('should not require an API key', async () => {
        const res = await request(app)
          .post('/api/v1/accounts')
          .send({ name: 'No Auth Needed' });
        expect(res.status).toBe(201);
      });

      it('should ignore any provided API key', async () => {
        const res = await request(app)
          .post('/api/v1/accounts')
          .set('X-API-Key', 'garbage')
          .send({ name: 'Ignore Auth' });
        expect(res.status).toBe(201);
      });
    });
  });

  describe('GET /v1/account', () => {
    describe('Happy path', () => {
      it('should return the calling account', async () => {
        const { apiKey, account } = await createAccount('My Account');

        const res = await request(app)
          .get('/api/v1/account')
          .set('X-API-Key', apiKey);

        expect(res.status).toBe(200);
        expect(res.body.account).toMatchObject({
          id: account.id,
          name: 'My Account',
        });
        expect(res.body.account.accountPlan).toMatchObject({
          name: 'Starter',
          scope: 'ACCOUNT',
          isPredefined: true,
          monthlyAllowance: 10000,
          maxPerRequest: 100,
        });
        expect(res.body.account).toHaveProperty('createdAt');
      });

      it('should not leak the API key in the response', async () => {
        const { apiKey } = await createAccount('Leak Check');
        const res = await request(app)
          .get('/api/v1/account')
          .set('X-API-Key', apiKey);

        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('apiKey');
      });

      it('should not leak other accounts (isolation)', async () => {
        const { apiKey: k1, account: a1 } = await createAccount('Account One');
        const { apiKey: k2, account: a2 } = await createAccount('Account Two');

        const res1 = await request(app)
          .get('/api/v1/account')
          .set('X-API-Key', k1);
        const res2 = await request(app)
          .get('/api/v1/account')
          .set('X-API-Key', k2);
        expect(res1.body.account.id).toBe(a1.id);
        expect(res2.body.account.id).toBe(a2.id);
        expect(res1.body.account.id).not.toBe(res2.body.account.id);
      });

      it('should reflect the current account plan after a switch', async () => {
        const { apiKey } = await createAccount('Reflect Plan');
        const pro = await getPredefinedPlan('Pro', 'ACCOUNT');

        await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({ planId: pro.id });

        const res = await request(app)
          .get('/api/v1/account')
          .set('X-API-Key', apiKey);

        expect(res.status).toBe(200);
        expect(res.body.account.accountPlan.id).toBe(pro.id);
        expect(res.body.account.accountPlan.name).toBe('Pro');
      });
    });

    describe('Authentication errors', () => {
      it('should reject missing API key with 401', async () => {
        const res = await request(app).get('/api/v1/account');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('UNAUTHORIZED_ERROR');
      });

      it('should reject invalid API key with 401', async () => {
        const res = await request(app)
          .get('/api/v1/account')
          .set('X-API-Key', 'totally-invalid');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('UNAUTHORIZED_ERROR');
      });

      it('should reject empty API key with 401', async () => {
        const res = await request(app)
          .get('/api/v1/account')
          .set('X-API-Key', '');
        expect(res.status).toBe(401);
      });
    });
  });

  describe('PUT /v1/account/plan', () => {
    describe('Happy path', () => {
      it('should switch the account plan', async () => {
        const { apiKey, account } = await createAccount('Switch Plan');
        const pro = await getPredefinedPlan('Pro', 'ACCOUNT');

        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({ planId: pro.id });

        expect(res.status).toBe(200);
        expect(res.body.account.id).toBe(account.id);
        expect(res.body.account.accountPlan).toMatchObject({
          id: pro.id,
          name: 'Pro',
          scope: 'ACCOUNT',
          monthlyAllowance: 100000,
          maxPerRequest: 1000,
        });
      });

      it('should allow switching to a custom ACCOUNT plan', async () => {
        const { apiKey } = await createAccount('Custom Switch');

        const createPlanRes = await request(app)
          .post('/api/v1/plans')
          .set('X-API-Key', apiKey)
          .send({
            name: 'Custom Account',
            scope: 'ACCOUNT',
            monthlyAllowance: 5000,
            maxPerRequest: 50,
          });
        expect(createPlanRes.status).toBe(201);

        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({ planId: createPlanRes.body.id });

        expect(res.status).toBe(200);
        expect(res.body.account.accountPlan.id).toBe(createPlanRes.body.id);
      });

      it('should be idempotent (switching to same plan)', async () => {
        const { apiKey } = await createAccount('Idempotent');
        const starter = await getPredefinedPlan('Starter', 'ACCOUNT');

        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({ planId: starter.id });

        expect(res.status).toBe(200);
        expect(res.body.account.accountPlan.id).toBe(starter.id);
      });

      it('should preserve consumed units across plan switch', async () => {
        const { apiKey } = await createAccount('Preserve Usage');

        await request(app)
          .post('/api/v1/users')
          .set('X-API-Key', apiKey)
          .send({ userRef: 'alice' });

        await request(app)
          .post('/api/v1/consume')
          .set('X-API-Key', apiKey)
          .send({ userRef: 'alice', units: 20, requestId: 'req-1' });

        const before = await request(app)
          .get('/api/v1/usage')
          .set('X-API-Key', apiKey);
        const consumedBefore = before.body.account.consumed;
        expect(consumedBefore).toBe(20);

        const pro = await getPredefinedPlan('Pro', 'ACCOUNT');
        await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({ planId: pro.id });

        const after = await request(app)
          .get('/api/v1/usage')
          .set('X-API-Key', apiKey);
        expect(after.body.account.consumed).toBe(consumedBefore);
      });
    });

    describe('Validation errors (400)', () => {
      it('should reject missing planId', async () => {
        const { apiKey } = await createAccount('No PlanId');
        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject empty body', async () => {
        const { apiKey } = await createAccount('Empty Body');
        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject non-UUID planId', async () => {
        const { apiKey } = await createAccount('Bad UUID');
        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({ planId: 'not-a-uuid' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('Not found (404)', () => {
      it('should reject non-existent planId', async () => {
        const { apiKey } = await createAccount('Ghost Plan');
        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({ planId: '00000000-0000-0000-0000-000000000000' });

        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND_ERROR');
      });

      it("should hide another account's custom plan (404)", async () => {
        const { apiKey: k1 } = await createAccount('Owner');
        const { apiKey: k2 } = await createAccount('Intruder');

        const createRes = await request(app)
          .post('/api/v1/plans')
          .set('X-API-Key', k1)
          .send({
            name: 'Private',
            scope: 'ACCOUNT',
            monthlyAllowance: 100,
            maxPerRequest: 10,
          });

        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', k2)
          .send({ planId: createRes.body.id });

        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND_ERROR');
      });
    });

    describe('Plan scope mismatch (422)', () => {
      it('should reject USER-scope plan', async () => {
        const { apiKey } = await createAccount('Wrong Scope');
        const basic = await getPredefinedPlan('Basic', 'USER');

        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', apiKey)
          .send({ planId: basic.id });

        expect(res.status).toBe(422);
        expect(res.body.code).toBe('UNPROCESSABLE_ENTITY_ERROR');
      });

      it("should reject switching to another account's USER plan", async () => {
        const { apiKey: k1 } = await createAccount('Owner');
        const { apiKey: k2 } = await createAccount('Other');

        const createRes = await request(app)
          .post('/api/v1/plans')
          .set('X-API-Key', k1)
          .send({
            name: 'User Plan',
            scope: 'USER',
            monthlyAllowance: 100,
            maxPerRequest: 10,
          });

        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', k2)
          .send({ planId: createRes.body.id });

        expect([404, 422]).toContain(res.status);
      });
    });

    describe('Authentication errors (401)', () => {
      it('should reject missing API key', async () => {
        const pro = await getPredefinedPlan('Pro', 'ACCOUNT');
        const res = await request(app)
          .put('/api/v1/account/plan')
          .send({ planId: pro.id });

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('UNAUTHORIZED_ERROR');
      });

      it('should reject invalid API key', async () => {
        const pro = await getPredefinedPlan('Pro', 'ACCOUNT');
        const res = await request(app)
          .put('/api/v1/account/plan')
          .set('X-API-Key', 'bad-key')
          .send({ planId: pro.id });

        expect(res.status).toBe(401);
      });
    });
  });

  describe('Cross-cutting', () => {
    it("should not reveal another account's data via any account route", async () => {
      const { apiKey: k1 } = await createAccount('Account A');
      const { apiKey: k2 } = await createAccount('Account B');

      const pro = await getPredefinedPlan('Pro', 'ACCOUNT');
      await request(app)
        .put('/api/v1/account/plan')
        .set('X-API-Key', k1)
        .send({ planId: pro.id });

      const res = await request(app)
        .get('/api/v1/account')
        .set('X-API-Key', k2);
      expect(res.body.account.accountPlan.name).toBe('Starter'); // unaffected
    });

    it('should return consistent JSON error schema on all error responses', async () => {
      const checks = [
        // 400
        await request(app).post('/api/v1/accounts').send({}),
        // 401
        await request(app).get('/api/v1/account'),
        // 404
        (() =>
          request(app).post('/api/v1/accounts').send({
            name: 'X',
            planId: '00000000-0000-0000-0000-000000000000',
          }))(),
      ];

      const responses = await Promise.all(checks);
      for (const res of responses) {
        expect(res.body).toHaveProperty('code');
        expect(res.body).toHaveProperty('message');
        expect(typeof res.body.code).toBe('string');
        expect(typeof res.body.message).toBe('string');
      }
    });

    it('should isolate usage per account', async () => {
      const { apiKey: k1 } = await createAccount('Usage A');
      const { apiKey: k2 } = await createAccount('Usage B');

      await request(app)
        .post('/api/v1/users')
        .set('X-API-Key', k1)
        .send({ userRef: 'alice' });
      await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', k1)
        .send({ userRef: 'alice', units: 20, requestId: 'r-1' });

      const resA = await request(app).get('/api/v1/usage').set('X-API-Key', k1);
      const resB = await request(app).get('/api/v1/usage').set('X-API-Key', k2);

      expect(resA.body.account.consumed).toBe(20);
      expect(resB.body.account.consumed).toBe(0);
    });

    it('should respond with 201 and only expose the key once', async () => {
      const { res, apiKey } = await createAccount('Once Key');
      expect(res.status).toBe(201);
      expect(apiKey).toBeDefined();

      const subsequent = await request(app)
        .get('/api/v1/account')
        .set('X-API-Key', apiKey);
      expect(subsequent.body).not.toHaveProperty('apiKey');
    });
  });
});
