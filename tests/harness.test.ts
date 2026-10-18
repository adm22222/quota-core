import { expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';
import { resetDb } from './helpers/test-db.ts';
import { prisma } from '../src/shared/prisma.ts';

it('harness works', async () => {
  await resetDb();

  expect(await prisma.plan.count()).toBe(4);

  expect((await request(app).get('/health')).status).toBe(200);

  expect(
    (await request(app).post('/api/v1/accounts').send({ name: 'x' })).status,
  ).toBe(201);

  await resetDb();

  expect(await prisma.account.count()).toBe(0);
  expect(await prisma.plan.count()).toBe(4);
});
