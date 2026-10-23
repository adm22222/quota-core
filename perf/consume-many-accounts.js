import http from 'k6/http';
import { check } from 'k6';
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
const invariantFailures = new Counter('usage_invariant_failures');

const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || '30s';
const ACCOUNTS = Number(__ENV.ACCOUNTS || 20);
const UNITS = Number(__ENV.UNITS || 1);
const PRE_ALLOCATED_VUS = Number(__ENV.VUS || 100);
const MAX_VUS = Number(__ENV.MAX_VUS || 400);

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
  !Number.isInteger(ACCOUNTS) ||
  ACCOUNTS < 1 ||
  !Number.isInteger(UNITS) ||
  UNITS < 1 ||
  PRE_ALLOCATED_VUS < 1 ||
  MAX_VUS < PRE_ALLOCATED_VUS
) {
  throw new Error(
    'Invalid RATE, ACCOUNTS, UNITS, VUS, or MAX_VUS configuration',
  );
}

const EXPECTED_ITERATIONS = Math.floor(
  RATE * durationToSeconds(DURATION) * 0.95,
);

export const options = {
  scenarios: {
    spread: {
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
    'http_req_duration{scenario:spread}': ['p(95)<1000'],
    checks: ['rate>0.99'],
    dropped_iterations: ['count<1'],
    iterations: [`count>${EXPECTED_ITERATIONS - 1}`],
    consume_invalid_responses: ['count<1'],
    usage_invariant_failures: ['count<1'],
  },
};

export function setup() {
  const run = runId();

  console.log(
    `Many-accounts test: RATE=${RATE}/s, DURATION=${DURATION}, ` +
      `ACCOUNTS=${ACCOUNTS}, UNITS=${UNITS}, ` +
      `VUS=${PRE_ALLOCATED_VUS}, MAX_VUS=${MAX_VUS}, ` +
      `expected iterations >= ${EXPECTED_ITERATIONS}`,
  );

  const accounts = [];

  for (let i = 0; i < ACCOUNTS; i++) {
    accounts.push(
      bootstrapAccount({
        name: `perf-many-${run}-${i}`,
        users: 2,
      }),
    );
  }

  return { accounts, run };
}

export default function (d) {
  const n = exec.scenario.iterationInTest;
  const account = d.accounts[n % d.accounts.length];
  const userRef = account.users[n % account.users.length];

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
        'X-API-Key': account.apiKey,
      },
      tags: { name: 'consume' },
    },
  );

  const statusOk = check(res, {
    'consume returns HTTP 200': (r) => r.status === 200,
  });

  if (!statusOk) {
    invalidResponses.add(1);

    console.error(
      `HTTP ${res.status} | iteration=${n} | ` +
        `duration=${res.timings.duration}ms | ` +
        `body=${String(res.body).slice(0, 500)}`,
    );

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
  let failedAccounts = 0;

  for (let i = 0; i < d.accounts.length; i++) {
    const account = d.accounts[i];
    const result = accountEqualsUsers(account.apiKey);

    const invariantOk = check(result, {
      'account total equals sum of users': (r) => r.ok === true,
    });

    if (!invariantOk) {
      failedAccounts++;
      invariantFailures.add(1);
    }

    console.log(
      `Invariant account ${i + 1}/${d.accounts.length}: ` +
        `account=${result.account}, users=${result.users}, ok=${result.ok}`,
    );
  }

  console.log(
    `Invariant summary: ${d.accounts.length - failedAccounts}/` +
      `${d.accounts.length} accounts passed`,
  );
}

export const handleSummary = summaryTo('many-accounts');
