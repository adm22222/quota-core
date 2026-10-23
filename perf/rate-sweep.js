import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { API, bootstrapAccount, runId, summaryTo } from './lib.js';

const RATES = (__ENV.RATES || '5,10,15,20,30,40,50').split(',').map(Number);
const STEP_S = Number(String(__ENV.STEP || '20s').replace('s', ''));
const GAP_S = 10;

const scenarios = {};
const thresholds = {};
RATES.forEach((rate, i) => {
  scenarios[`r${rate}`] = {
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1s',
    duration: `${STEP_S}s`,
    startTime: `${i * (STEP_S + GAP_S)}s`,
    preAllocatedVUs: 50,
    maxVUs: 300,
    tags: { rate: String(rate) },
  };
  thresholds[`http_req_duration{rate:${rate}}`] = ['p(95)<1e9'];
  thresholds[`http_req_failed{rate:${rate}}`] = ['rate<=1'];
});
export const options = { scenarios, thresholds };

export const setup = () => {
  return {
    ...bootstrapAccount({ name: `perf-sweep-${runId()}`, users: 5 }),
    run: runId(),
  };
};

export default function (d) {
  const n = exec.scenario.iterationInTest;
  const res = http.post(
    `${API}/consume`,
    JSON.stringify({
      userRef: d.users[n % d.users.length],
      units: 1,
      requestId: `${d.run}-${exec.scenario.name}-${n}`,
    }),
    { headers: { 'Content-Type': 'application/json', 'X-API-Key': d.apiKey } },
  );
  check(res, { 'status is 200': (r) => r.status === 200 });
}

export const handleSummary = summaryTo('rate-sweep');
