import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import {
  API,
  call,
  bootstrapAccount,
  accountEqualsUsers,
  runId,
  summaryTo,
} from './lib.js';

export const options = {
  scenarios: {
    traffic: {
      executor: 'constant-arrival-rate',
      exec: 'consume',
      rate: Number(__ENV.RATE || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
    editor: {
      executor: 'constant-vus',
      exec: 'edit',
      vus: 1,
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    'http_req_failed{scenario:traffic}': ['rate<0.01'],
    'checks{scenario:traffic}': ['rate>0.99'],
  },
};

export function setup() {
  return {
    ...bootstrapAccount({
      name: `perf-edit-${runId()}`,
      users: 5,
      accountLimits: { monthlyAllowance: 200, maxPerRequest: 10 },
    }),
    run: runId(),
  };
}

export function consume(d) {
  const n = exec.scenario.iterationInTest;
  const res = http.post(
    `${API}/consume`,
    JSON.stringify({
      userRef: d.users[n % d.users.length],
      units: 1 + (n % 5),
      requestId: `${d.run}-${n}`,
    }),
    { headers: { 'Content-Type': 'application/json', 'X-API-Key': d.apiKey } },
  );
  check(res, { 'status is 200': (r) => r.status === 200 });
}

export function edit(d) {
  const sizes = [50, 400, 120, 1000, 80];
  const i = exec.scenario.iterationInTest;
  const res = call(
    'PUT',
    `/plans/${d.accountPlanId}`,
    { monthlyAllowance: sizes[i % sizes.length], maxPerRequest: 10 },
    d.apiKey,
  );
  check(res, { 'plan edit returned 200': (r) => r.status === 200 });
  sleep(2);
}

export function teardown(d) {
  const r = accountEqualsUsers(d.apiKey);
  check(r, { 'account total equals sum of users': (x) => x.ok });
  console.log(`invariant: account=${r.account} users=${r.users} ok=${r.ok}`);
}

export const handleSummary = summaryTo('plan-update');
