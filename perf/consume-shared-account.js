import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';
import {
  API,
  bootstrapAccount,
  accountEqualsUsers,
  runId,
  summaryTo,
} from './lib.js';

const accepted = new Counter('consume_accepted');
const rejected = new Counter('consume_rejected');
const acceptedUnits = new Counter('consume_accepted_units');
const invalidResponses = new Counter('consume_invalid_responses');

const RATE = Number(__ENV.RATE || 20);
const DURATION = __ENV.DURATION || '30s';
const USERS = Number(__ENV.USERS || 5);
const UNITS = Number(__ENV.UNITS || 1);
const PRE_ALLOCATED_VUS = Number(__ENV.VUS || 50);
const MAX_VUS = Number(__ENV.MAX_VUS || 200);

function durationToSeconds(value) {
  const match = value.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);

  if (!match) {
    throw new Error(`Unsupported DURATION: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  return (
    amount *
    {
      ms: 0.001,
      s: 1,
      m: 60,
      h: 3600,
    }[unit]
  );
}

if (
  !Number.isFinite(RATE) ||
  RATE < 1 ||
  !Number.isInteger(USERS) ||
  USERS < 1 ||
  !Number.isInteger(UNITS) ||
  UNITS < 1 ||
  PRE_ALLOCATED_VUS < 1 ||
  MAX_VUS < PRE_ALLOCATED_VUS
) {
  throw new Error('Invalid RATE, USERS, UNITS, VUS, or MAX_VUS configuration');
}

const EXPECTED_ITERATIONS = Math.floor(
  RATE * durationToSeconds(DURATION) * 0.95,
);

export const options = {
  scenarios: {
    contention: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
    },
  },

  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:contention}': ['p(95)<1000'],
    checks: ['rate>0.99'],
    dropped_iterations: ['count<1'],
    iterations: [`count>${EXPECTED_ITERATIONS - 1}`],
    consume_invalid_responses: ['count<1'],
  },
};

export function setup() {
  const run = runId();

  console.log(
    `Shared-account test: RATE=${RATE}/s, DURATION=${DURATION}, ` +
      `USERS=${USERS}, UNITS=${UNITS}, ` +
      `VUS=${PRE_ALLOCATED_VUS}, MAX_VUS=${MAX_VUS}, ` +
      `expected iterations >= ${EXPECTED_ITERATIONS}`,
  );

  const account = bootstrapAccount({
    name: `perf-shared-${run}`,
    users: USERS,
  });

  return { ...account, run };
}

export default function (d) {
  const n = exec.scenario.iterationInTest;
  const userRef = d.users[n % d.users.length];

  const res = http.post(
    `${API}/consume`,
    JSON.stringify({
      userRef,
      units: UNITS,
      requestId: `${d.run}-${n}`,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': d.apiKey,
      },
      tags: { name: 'consume' },
    },
  );

  const statusOk = check(res, {
    'consume returns HTTP 200': (r) => r.status === 200,
  });

  if (!statusOk) {
    invalidResponses.add(1);

    if (n < 3) {
      console.error(`HTTP ${res.status}: ${String(res.body).slice(0, 300)}`);
    }

    return;
  }

  let body;

  try {
    body = res.json();
  } catch {
    invalidResponses.add(1);
    console.error(`Invalid JSON response at iteration ${n}`);
    return;
  }

  const responseValid = check(body, {
    'response contains boolean accepted': (b) =>
      b !== null && typeof b === 'object' && typeof b.accepted === 'boolean',
  });

  if (!responseValid) {
    invalidResponses.add(1);

    if (n < 3) {
      console.error(
        `Invalid consume response: ${String(res.body).slice(0, 300)}`,
      );
    }

    return;
  }

  if (body.accepted) {
    accepted.add(1);
    acceptedUnits.add(UNITS);
  } else {
    rejected.add(1);
  }
}

export function teardown(d) {
  const result = accountEqualsUsers(d.apiKey);

  const invariantOk = check(result, {
    'account total equals sum of users': (r) => r.ok === true,
  });

  console.log(
    `Invariant: account=${result.account}, users=${result.users}, ` +
      `ok=${result.ok}`,
  );

  if (!invariantOk) {
    fail('Shared-account usage invariant failed');
  }
}

export const handleSummary = summaryTo('shared-account');
