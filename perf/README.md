# Performance Tests

Load tests for the Quota Service using [k6](https://k6.io). This document records the test setup, measured results, accounting checks, and findings from the performance improvements.

## Summary

- **Correctness checks passed in the recorded runs.** The three 20-account runs completed without HTTP failures or dropped iterations, and all 20 accounts passed the accounting invariant. A separate SQL invariant check returned zero violations.
- **The original single-account test exposed a bottleneck.** At a target of 20 requests/s, the earlier run achieved approximately 10.47 iterations/s, with 148 dropped iterations, 1.88 s average latency, and 12.27 s p95 latency.
- **The optimized single-account run performed substantially better.** At the same configured target of 20 iterations/s for 30 seconds, it completed 601 iterations with no dropped iterations, no HTTP failures, and 76.45 ms p95 latency.
- **Load spread across accounts was stable in two of three runs.** All three runs completed 1,201 iterations with zero dropped iterations and zero HTTP failures. The second run had a higher p95 latency than the other two, indicating variability between runs.
- **The rate sweep showed increasing latency at higher offered rates.** The p95 latency increased from 131.31 ms at 40 requests/s to 446.57 ms at 50 requests/s.

## Requirements

- The service and PostgreSQL must be running and reachable.
- k6 installed locally or available through Docker.
- The API is served under `/api/v1`; see [`docs/openapi.yaml`](../docs/openapi.yaml).
- Use a dedicated test database. Do not run load tests against production data.

## Running the tests

The following commands use the script paths used in the current project.

### Single-account contention

PowerShell:

```powershell
k6 run --out json=perf/results/single-account-after.json `
  -e RATE=20 `
  -e DURATION=30s `
  perf/consume-shared-account.js
```

This test sends concurrent consumption requests to one shared account, exercising contention on that account's usage records.

### Load spread across accounts

```powershell
k6 run --out json=perf/results/many-accounts-run1.json `
  -e RATE=40 `
  -e DURATION=30s `
  -e ACCOUNTS=20 `
  perf/consume-many-accounts.js
```

Use a different output filename for each run, such as `many-accounts-run2.json` and `many-accounts-run3.json`.

### Rate sweep

```powershell
k6 run --out json=perf/results/rate-sweep.json `
  perf/rate-sweep.js
```

The rate-sweep script controls its own sequence of rates. The recorded run tested 5, 10, 15, 20, 30, 40,and 50 requests/s.

### Docker

When running k6 inside Docker, mount the `perf` directory into the container and set `BASE_URL` to the host-accessible service URL. For example:

```powershell
docker run --rm -i `
  -v "${PWD}/perf:/perf" `
  -e BASE_URL=http://host.docker.internal:3000 `
  -e RATE=20 `
  -e DURATION=30s `
  grafana/k6 run /perf/consume-shared-account.js
```

Ensure `perf/results` exists before running tests that write result files. If a script attempts to save its automatic summary under `/perf/results/` and fails, check the container mount and directory. An explicit `--out json=...` output and the automatic end-of-test summary are separate outputs.

## Accounting invariant

After each test, verify that account-level usage agrees with the sum of its users' usage and that no pending consumption records remain.

On Windows PowerShell, the recorded SQL check was run using:

```powershell
Get-Content ".\perf\check-invariant.sql" -Raw |
  docker exec -i quota-core-postgres psql -U quota_user -d quota_core
```

Expected outcome: zero rows in the `violation` result, with no accounting inconsistencies detected by the query.

The recorded execution returned:

```text
 violation | key
-----------+-----
(0 rows)
```

The three many-account runs also reported `ok=true` for all 20 accounts and an invariant summary of `20/20 accounts passed`.

## Tests

| Script                      | Purpose                                                           | Main settings                                                                  |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `consume-shared-account.js` | Measure contention when requests share one account                | `RATE=20`, `DURATION=30s`, `USERS=5`, `UNITS=1`, `VUS=50`, `MAX_VUS=200`       |
| `consume-many-accounts.js`  | Measure performance when requests are distributed across accounts | `ACCOUNTS=20`, `RATE=100`, `DURATION=30s`, `UNITS=1`, `VUS=100`, `MAX_VUS=400` |
| `rate-sweep.js`             | Observe latency as the offered request rate increases             | `RATES=5,10,15,20,30,40,50`, `STEP=20s`                                        |
| `duplicate-request-ids.js`  | Verify idempotency when a request ID is reused concurrently       | `RATE=10`, `DURATION=20s`, `VUS=50`, `MAX_VUS=200`                             |

The results below cover the single-account test, the rate sweep, the many-account test, and the SQL invariant check. Results for `duplicate-request-ids.js` and `plan-update-under-load.js` have not been included because their output was not available for this update.

## How to read k6 output

| Metric                  | Meaning                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `iterations`            | Completed test iterations. The reported rate can include setup and teardown time. |
| `dropped_iterations`    | Scheduled iterations that k6 could not start on time.                             |
| `http_req_duration` p95 | 95% of measured HTTP requests completed within this duration.                     |
| `http_req_failed`       | Fraction of HTTP requests classified as failed by k6.                             |
| `http_reqs`             | Total HTTP requests, which may differ from the iteration count.                   |
| `checks`                | Results of the script's assertions.                                               |
| Invariant summary       | Whether the accounting checks passed for the tested accounts.                     |

## Environment

| Item                          | Value                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| Operating system              | Windows with Docker-based services/tools in the recorded workflow      |
| API base URL                  | `http://localhost:3000/api/v1`                                         |
| PostgreSQL container          | `quota-core-postgres`                                                  |
| Test database                 | `quota_core`                                                           |
| PostgreSQL version            | `17` (`postgres:17` in `compose.yaml`)                                 |
| Service instances             | 1, according to the recorded test setup                                |
| Connection pool               | `max: 10`, `connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 10000` |
| Transaction limits            | `maxWait: 5000 ms`, `timeout: 5000 ms`                                 |
| In-process concurrency limits | 3 concurrent transactions per account, 8 globally                      |
| k6 version                    | Docker image `grafana/k6:latest` (exact version not pinned)            |

The service, database, and load generator share the development environment. These measurements should not be interpreted as a production capacity guarantee.

## Results

### 1. Before vs. after: one shared account

**Configured target:** 20 iterations/s for 30 seconds.

| Metric                                |                 Before improvements |              After improvements |
| ------------------------------------- | ----------------------------------: | ------------------------------: |
| Completed iterations / accepted units |                   Approximately 453 |                             601 |
| Reported iteration rate               |                             10.47/s |                         19.66/s |
| Dropped iterations                    |                                 148 |                               0 |
| Average HTTP latency                  |                              1.88 s |                        46.75 ms |
| Median HTTP latency                   |                        Not recorded |                        46.83 ms |
| p95 HTTP latency                      |                             12.27 s |                        76.45 ms |
| Maximum HTTP latency                  |                        Not recorded |                       160.82 ms |
| HTTP failures                         |                                  0% |                              0% |
| k6 checks                             |  Original output not fully retained |   100% (1,203 passed, 0 failed) |
| Accounting invariant                  | Passed in the original recorded run | SQL check returned 0 violations |

The reported iteration rate increased by approximately **1.88×**. Dropped iterations fell from 148 to zero, while p95 latency decreased from 12.27 seconds to 76.45 milliseconds.

These numbers are useful as a before-and-after comparison provided the original and optimized runs used equivalent scripts, target rate, duration, and VU settings.

### 2. Rate sweep: one shared account

The following measurements came from the recorded rate-sweep run. Latency is in milliseconds except where shown in seconds.

| Target rate (req/s) | Completed iterations |       p50 |       p95 | HTTP failure rate |
| ------------------: | -------------------: | --------: | --------: | ----------------: |
|                   5 |                  100 |  75.95 ms | 181.49 ms |                0% |
|                  10 |                  200 |  37.25 ms |  63.62 ms |                0% |
|                  15 |                  301 |  33.91 ms |  59.33 ms |                0% |
|                  20 |                  401 |  30.62 ms |  70.60 ms |                0% |
|                  30 |                  600 |  26.72 ms |  83.77 ms |                0% |
|                  40 |                  801 |  28.78 ms | 131.31 ms |                0% |
|                  50 |                1,001 | 104.70 ms | 146.57 ms |                0% |

**Overall run results:**

- Completed iterations: 3,404
- Dropped iterations: 0
- HTTP requests: 3,413
- HTTP failures: 0 (0%)
- Checks: 4,535 passed, 0 failed
- Maximum observed VUs: 50

### 3. Load spread across 20 accounts

**Configured target:** 40 iterations/s for 30 seconds, with 20 accounts.

All three runs completed 1,201 iterations, reported zero dropped iterations, and recorded zero HTTP failures. Each run also passed the accounting invariant for all 20 accounts.

| Metric                                |        Run 1 |        Run 2 |        Run 3 |
| ------------------------------------- | -----------: | -----------: | -----------: |
| Completed iterations / accepted units |        1,201 |        1,201 |        1,201 |
| Reported iteration rate               |      34.76/s |      34.04/s |      34.86/s |
| HTTP requests                         |        1,341 |        1,341 |        1,341 |
| Dropped iterations                    |            0 |            0 |            0 |
| Median HTTP latency                   |     34.66 ms |     40.13 ms |     35.99 ms |
| Average HTTP latency                  |     41.48 ms |     80.41 ms |     42.08 ms |
| p95 HTTP latency                      |     77.54 ms |    307.92 ms |     76.95 ms |
| Maximum HTTP latency                  |    166.72 ms |    614.75 ms |    187.78 ms |
| HTTP failures                         |           0% |           0% |           0% |
| k6 checks                             |         100% |         100% |         100% |
| Accounting invariant                  | 20/20 passed | 20/20 passed | 20/20 passed |

The second run had substantially higher average and p95 latency, even though its checks, dropped-iteration count, and HTTP failure rate were the same as the other runs. This is a sign of variability under the same configuration and should be retained in the results rather than reporting only the best run.

## Findings

### 1. Reducing work in the serialized section improved single-account performance

Requests consuming a shared account allowance must coordinate through the account's usage row. Holding that lock for too long causes requests to queue.

The original run showed low throughput and high tail latency. The optimized run achieved 19.66 reported iterations/s with no dropped iterations and a p95 of 76.45 ms at a target of 20 iterations/s.

### 2. Changes made to reduce lock duration and connection pressure

| Change                                                                                  | Reason                                                                                       |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Lock only the account's usage row instead of also locking the user row                  | Avoids an unnecessary lock and additional round trip.                                        |
| Create the monthly usage row only when it does not exist                                | Removes work from the common request path.                                                   |
| Read plans and user usage after acquiring the account lock, in one statement            | Reduces round trips and avoids decisions based on stale plan data.                           |
| Write both usage counters and the accepted-request history in one SQL statement         | Reduces database work while holding the lock.                                                |
| Apply per-account and global in-process concurrency limits before opening a transaction | Prevents requests waiting in the application queue from holding pooled database connections. |
| Configure explicit pool and transaction limits                                          | Bounds connection usage and transaction waiting time.                                        |

### 3. Correctness matters alongside latency

Two correctness concerns identified during development were stale plan reads and history timestamps.

- **Stale plans:** Reading a plan before waiting for the account lock can allow a request to use outdated limits if a plan edit commits while it waits. The plan is now read under the lock.
- **History timestamps:** PostgreSQL's `CURRENT_TIMESTAMP` reflects the transaction start time. For long transactions, this can differ significantly from the time the decision is written. The implementation uses `clock_timestamp()` when recording the decision.

The invariant checks are important because improved latency is not useful if account totals and user totals diverge.

### 4. Account-level contention is an inherent limit

Requests for the same account must coordinate access to shared usage. Increasing the connection pool alone cannot eliminate that serialization. Different accounts can make progress independently, which is why the many-account test measures a different workload from the shared-account test.

The recorded results are consistent with this design: the optimized single-account test handles the configured 20 iterations/s target without drops, while the rate sweep shows increasing tail latency at higher offered rates.
