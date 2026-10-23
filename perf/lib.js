import http from 'k6/http';
import { fail } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API = `${BASE_URL}/api/v1`;
const HUGE = 1_000_000_000;

export const call = (method, path, body, key) => {
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['X-API-Key'] = key;
  return http.request(
    method,
    `${API}${path}`,
    body === undefined ? null : JSON.stringify(body),
    { headers },
  );
};

const must = (res, status, what) => {
  if (res.status !== status)
    fail(`setup: ${what} returned ${res.status}: ${res.body}`);
  return res.json();
};

export const bootstrapAccount = ({
  name,
  users = 5,
  accountLimits,
  userLimits,
}) => {
  const aL = { monthlyAllowance: HUGE, maxPerRequest: 1000, ...accountLimits };
  const uL = { monthlyAllowance: HUGE, maxPerRequest: 1000, ...userLimits };
  const created = must(
    call('POST', '/accounts', { name }),
    201,
    'create account',
  );
  const key = created.apiKey;
  const acctPlan = must(
    call(
      'POST',
      '/plans',
      { name: 'perf-account', scope: 'ACCOUNT', ...aL },
      key,
    ),
    201,
    'create account plan',
  );
  must(
    call('PUT', '/account/plan', { planId: acctPlan.id }, key),
    200,
    'apply account plan',
  );
  const userPlan = must(
    call('POST', '/plans', { name: 'perf-user', scope: 'USER', ...uL }, key),
    201,
    'create user plan',
  );
  const refs = [];
  for (let i = 1; i <= users; i++) {
    const ref = `perf-user-${i}`;
    must(
      call('POST', '/users', { userRef: ref, planId: userPlan.id }, key),
      201,
      `create ${ref}`,
    );
    refs.push(ref);
  }
  return {
    apiKey: key,
    accountId: created.account.id,
    accountPlanId: acctPlan.id,
    userPlanId: userPlan.id,
    users: refs,
  };
};

export const accountEqualsUsers = (apiKey) => {
  const res = call('GET', '/usage?limit=200', undefined, apiKey);
  if (res.status !== 200)
    return { ok: false, detail: `usage returned ${res.status}` };
  const body = res.json();
  const sum = body.users.reduce((s, u) => s + u.consumed, 0);
  return {
    ok: body.account.consumed === sum && !body.nextCursor,
    account: body.account.consumed,
    users: sum,
  };
};

export const runId = () =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export const summaryTo = (name) => (data) => ({
  stdout: textSummary(data, { indent: ' ', enableColors: false }),
  [`/perf/results/${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`]:
    JSON.stringify(data, null, 2),
});
