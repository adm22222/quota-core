import { expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';
import { resetDb } from './helpers/test-db.ts';
import { prisma } from '../src/shared/prisma.ts';

it('harness works', async () => {
  await resetDb();

  expect(await prisma.plan.count()).toBe(3);

  expect((await request(app).get('/api/v1/health')).status).toBe(200);

  expect(
    (await request(app).post('/api/v1/accounts').send({ name: 'x' })).status,
  ).toBe(201);

  await resetDb();

  expect(await prisma.account.count()).toBe(0);
  expect(await prisma.plan.count()).toBe(3);
});
