import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import {
  API,
  bootstrapAccount,
  accountEqualsUsers,
  runId,
  summaryTo,
} from './lib.js';

export const options = {
  scenarios: {
    dupes: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 10),
      timeUnit: '1s',
      duration: __ENV.DURATION || '20s',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: { checks: ['rate==1'], http_req_failed: ['rate<0.01'] },
};

export function setup() {
  return {
    ...bootstrapAccount({ name: `perf-dupes-${runId()}`, users: 3 }),
    run: runId(),
  };
}

export default function (d) {
  const n = exec.scenario.iterationInTest;
  const req = [
    'POST',
    `${API}/consume`,
    JSON.stringify({
      userRef: d.users[n % d.users.length],
      units: 1,
      requestId: `${d.run}-${n}`,
    }),
    { headers: { 'Content-Type': 'application/json', 'X-API-Key': d.apiKey } },
  ];
  const rs = http.batch([req, req, req, req, req]);
  check(rs, {
    'all five answered 200': (r) => r.every((x) => x.status === 200),
    'exactly one was processed': (r) =>
      r.filter((x) => x.status === 200 && x.json('replayed') === false)
        .length === 1,
    'all five carry the same decision': (r) =>
      new Set(r.map((x) => x.json('accepted'))).size === 1,
  });
}

export function teardown(d) {
  const r = accountEqualsUsers(d.apiKey);
  check(r, { 'account total equals sum of users': (x) => x.ok });
}

export const handleSummary = summaryTo('duplicates');
