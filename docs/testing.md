# Testing

## Current test strategy

| Layer       | Tooling            | Database                      | Current coverage                                                                                                |
| ----------- | ------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest             | None                          | Rules, API-key generation/hashing, fingerprints, validation, month and cursor helpers                           |
| Integration | Vitest + Supertest | Real PostgreSQL test database | Account creation, authentication, plan selection, account isolation, consumption, usage, and API error behavior |
| Load        | Not added yet      | Planned running stack         | k6 scripts are planned; there is currently no `perf/` directory or runnable k6 test                             |

The integration tests intentionally use PostgreSQL instead of mocks. Idempotency, unique constraints, transactions, row
locking, and usage accounting depend on database behavior.

## Run the tests

Install dependencies and make sure PostgreSQL is running:

```bash
pnpm install
```

Apply the migrations to the separate test database, then run the full suite:

```bash
pnpm prisma:migrate:test
pnpm test
```

Run an individual file:

```bash
pnpm exec vitest run tests/modules/rules/rule-evaluator.test.ts
pnpm exec vitest run tests/integration/consume.test.ts
```

The project uses `fileParallelism: false` because integration files share one database and reset it between tests.

## Test database

Tests load `.env.test` through the `test` script. The connection must point to a dedicated database whose name ends in
`_test`:

```env
DATABASE_URL=postgresql://quota_user:<password>@127.0.0.1:5432/quota_core_test?schema=public
```

Never point `.env.test` at the development database. The reset helper refuses to run unless `DATABASE_URL` looks like a
test connection, then truncates the application tables and reseeds the four predefined plans before each integration
test.

The test database must have migrations applied:

```bash
pnpm prisma:migrate:test
```

## Test layout

| Location                             | Purpose                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `tests/modules/rules/`               | Rule evaluator and individual quota-rule behavior                                  |
| `tests/modules/consumption/`         | Request fingerprint behavior                                                       |
| `tests/auth/`                        | API-key format, uniqueness, and SHA-256 hashing                                    |
| `tests/helpers/`                     | UTC month and cursor helpers, plus the database reset helper                       |
| `tests/middleware/`                  | Zod validation middleware and structured validation errors                         |
| `tests/integration/accounts.test.ts` | Account lifecycle, authentication, plan assignment, isolation, and error responses |
| `tests/integration/consume.test.ts`  | Accepted/rejected consumption, limits, replay behavior, usage, and history effects |
| `tests/harness.test.ts`              | Test reset, predefined-plan seeding, health, and basic API boot checks             |

## What is covered today

- Account creation with the default Starter plan and explicit predefined plans.
- One-time API-key return, key hashing, authentication failures, and account isolation.
- User and plan validation, plan scope rules, custom plan creation, and plan changes.
- Account and user per-request limits and monthly allowances.
- Atomic accepted/rejected consumption decisions and unchanged usage after rejection.
- Safe replay of a request with the same payload and conflict behavior for a reused request ID with a different payload.
- Usage and history snapshots, pagination, month handling, and structured API errors where covered by the integration tests.

## Known testing gaps

The following are not currently implemented as dedicated automated tests:

- Deadlock and overspending checks under contention.
- k6 load and soak tests.

These should be added before making performance or concurrency guarantees.

## Planned k6 tests

k6 is not installed or configured in this repository yet. When load testing is added, it should use a separate test
account and a running API instance rather than the Vitest database reset helper. A future layout can be:

```text
perf/
└── smoke.js
```

The intended Docker command is already reserved in `compose.yaml`:

```bash
docker compose --profile perf run --rm k6
```

That command is not runnable until `perf/smoke.js` exists. The first k6 scenario should verify API availability,
authenticated consumption, accepted/rejected decisions, and the accounting invariant that account consumption equals
the sum of user consumption.

## Useful checks

Run linting and formatting checks alongside the tests:

```bash
pnpm lint
pnpm format:check
pnpm test
```

When changing transaction or locking code, add a focused integration test before relying on the unit suite alone.
