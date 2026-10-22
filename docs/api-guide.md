# API guide

Machine-readable contract: [openapi.yaml](openapi.yaml). Interactive documentation: [Swagger UI](http://localhost:3000/api-docs).
This guide explains the conventions and shows a request and response for every route.

## Conventions

| Topic                     | Rule                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Base path                 | `/api/v1` (the health checks are `/api/v1/health`)                                                                 |
| Format                    | JSON requests and responses (`Content-Type: application/json`)                                                     |
| Authentication            | `X-API-Key: <key>` on every route except `POST /accounts` and `GET /health`                                        |
| Account scoping           | The account comes **only** from the key. No route takes an account id.                                             |
| Users                     | Identified by `userRef`, the caller's own id, unique per account, case-sensitive                                   |
| Units and limits          | Whole numbers; units and plan limits are 1 to 1,000,000,000                                                        |
| Months                    | UTC calendar months written `YYYY-MM`                                                                              |
| Pagination                | `limit` (default 50, maximum 200) and an opaque `cursor`; responses include `nextCursor` (`null` on the last page) |
| Other accounts' resources | Reported as `404`, so their existence is never revealed                                                            |

The examples below use one scenario: account **Acme Documents** on Starter, users **alice** (Basic) and **bob** (Basic).
IDs and timestamps are illustrative.

```bash
BASE=http://localhost:3000/api/v1
KEY=qtc_...     # from POST /accounts
```

## Common objects

**Plan**

```json
{
  "id": "5a0e1d7c-0000-4000-8000-000000000001",
  "name": "Starter",
  "scope": "ACCOUNT",
  "isPredefined": true,
  "monthlyAllowance": 10000,
  "maxPerRequest": 100,
  "createdAt": "2026-10-01T08:00:00.000Z",
  "updatedAt": "2026-10-01T08:00:00.000Z"
}
```

**LevelStatus**: limits and usage at one level for the month. `remaining` is `max(0, monthlyAllowance - consumed)` and is never negative.

```json
{
  "planId": "5a0e1d7c-0000-4000-8000-000000000001",
  "planName": "Starter",
  "monthlyAllowance": 10000,
  "maxPerRequest": 100,
  "consumed": 350,
  "remaining": 9650
}
```

**Violation**: a rule that blocked a request.

| Field       | Meaning                                                                               |
| ----------- | ------------------------------------------------------------------------------------- |
| `level`     | `ACCOUNT` or `USER`: whose plan blocked the request                                   |
| `rule`      | `MAX_PER_REQUEST` or `MONTHLY_ALLOWANCE`                                              |
| `limit`     | The configured value that was exceeded: the per-request cap, or the monthly allowance |
| `attempted` | The units requested                                                                   |
| `remaining` | Only for `MONTHLY_ALLOWANCE`: units still available at that level (never negative)    |

```json
{
  "level": "ACCOUNT",
  "rule": "MONTHLY_ALLOWANCE",
  "limit": 10000,
  "attempted": 10,
  "remaining": 5
}
```

## Errors

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed for field: units",
  "details": [
    { "field": "units", "message": "Units must be a positive integer" }
  ]
}
```

| Status | Code                                              | When                                                                            |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`                                | Invalid input. Not recorded in history.                                         |
| 401    | `UNAUTHORIZED_ERROR`                              | Key missing, malformed or unknown (all three look identical).                   |
| 403    | `FORBIDDEN_ERROR`                                 | Trying to edit a predefined plan.                                               |
| 404    | `NOT_FOUND_ERROR`, `UserNotFound`, `PlanNotFound` | Resource not found or it belongs to another account.                            |
| 409    | `CONFLICT_ERROR`                                  | Duplicate user, plan name, or request payload conflict.                         |
| 422    | `UNPROCESSABLE_ENTITY_ERROR`, `PlanScopeMismatch` | Plan scope does not match the target.                                           |
| 500    | `INTERNAL_SERVER_ERROR`                           | Unexpected failure. Retrying `POST /consume` with the same `requestId` is safe. |

---

## Operations

### `GET /api/v1/health`

No key. `200 { "status": "ok" }`. Also verifies the database connection.

## Accounts

### `POST /accounts`: create an account

Open endpoint. The account starts on **Starter** unless `planId` names another predefined **account** plan.

```bash
curl -X POST $BASE/accounts -H 'Content-Type: application/json' -d '{"name":"Acme Documents"}'
```

`201`, with `Cache-Control: no-store`:

```json
{
  "account": {
    "id": "7c1e4b52-3a9d-4f0e-8b6a-1d2c3e4f5a60",
    "name": "Acme Documents",
    "plan": { "...": "Plan" },
    "createdAt": "2026-10-18T08:30:00.000Z"
  },
  "apiKey": "qtc_9fK2xQ7c0pVbT3sLhYw8aZnR5dEuJm41"
}
```

The key is shown **once**. Only its SHA-256 hash is stored.

### `GET /account`: the calling account, its plan and limits

`200`: the `account` object above, without `apiKey`.

### `PUT /account/plan`: switch the account plan

```bash
curl -X PUT $BASE/account/plan -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"planId":"5a0e1d7c-0000-4000-8000-000000000002"}'
```

`200`: the account on its new plan. Errors: `404` (plan unknown or another account's), `422` (not an account plan).
Usage already consumed is kept; no fresh allowance is granted. The change applies to the next request.

## Users

### `POST /users`: register a user

```bash
curl -X POST $BASE/users -H "X-API-Key: $KEY" -H 'Content-Type: application/json' -d '{"userRef":"alice"}'
```

Optional `planId` selects a **user** plan (default **Basic**). `201`:

```json
{
  "userRef": "alice",
  "plan": { "...": "Plan" },
  "createdAt": "2026-10-18T08:31:00.000Z"
}
```

`userRef` allows letters, digits and `. _ : @ -` (1 to 128 characters). Errors: `409 CONFLICT_ERROR`, `404`, `422 PlanScopeMismatch`.

### `GET /users`: list users

Paginated. `200 { "items": [ User, ... ], "nextCursor": null }`. The order of `items` is not part of the contract.

### `GET /users/{userRef}`

`200`: one user with the plan and limits currently applied. `404` if unknown or in another account.

### `PUT /users/{userRef}/plan`: switch a user's plan

Body `{ "planId": "..." }`. `200`: the user on the new plan. Usage is kept, no fresh allowance is granted.

## Plans

### `GET /plans?scope=USER`

`200 { "items": [ Plan, ... ] }`: all **predefined** plans plus **this account's** custom plans. `scope` is optional.

### `POST /plans`: create a custom plan

```bash
curl -X POST $BASE/plans -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Team-X","scope":"USER","monthlyAllowance":1000,"maxPerRequest":20}'
```

`201`: the Plan (`isPredefined: false`). Several users may share one plan; each keeps separate usage.
Errors: `409 CONFLICT_ERROR`, `400 VALIDATION_ERROR`.

### `GET /plans/{planId}`

`200`: the Plan. Predefined plans and the account's own plans are visible; anything else is `404`.

### `PUT /plans/{planId}`: update a custom plan

Both limits are required (full replacement); `name` is optional.

```bash
curl -X PUT $BASE/plans/$PLAN -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"monthlyAllowance":100,"maxPerRequest":20}'
```

`200`: the updated Plan. It affects **every account or user using it, from the next request**. Past history is not rewritten.
If the allowance falls below current usage, `remaining` shows `0` and consumption at that level is rejected.
Errors: `403 FORBIDDEN_ERROR` for predefined plans, `404`, `409 CONFLICT_ERROR`.

## Consumption

### `POST /consume`

```bash
curl -X POST $BASE/consume -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"userRef":"alice","units":10,"requestId":"doc-8841"}'
```

| Field       | Rules                                                                               |
| ----------- | ----------------------------------------------------------------------------------- |
| `userRef`   | Must belong to the calling account                                                  |
| `units`     | A JSON integer from 1 to 1,000,000,000. `"10"`, `1.5` and `0` return `400`.         |
| `requestId` | Caller-chosen, 1 to 128 characters, unique **per account**. Reuse it only to retry. |

Every outcome below is **HTTP 200**.

**Accepted:** both counters grow by the same amount.

```json
{
  "requestId": "doc-8841",
  "userRef": "alice",
  "units": 10,
  "accepted": true,
  "replayed": false,
  "reason": null,
  "violations": [],
  "month": "2026-10",
  "processedAt": "2026-10-18T09:14:03.412Z",
  "account": {
    "planName": "Starter",
    "monthlyAllowance": 10000,
    "maxPerRequest": 100,
    "consumed": 350,
    "remaining": 9650
  },
  "user": {
    "planName": "Basic",
    "monthlyAllowance": 1000,
    "maxPerRequest": 20,
    "consumed": 150,
    "remaining": 850
  }
}
```

**Rejected:** nothing is consumed. `reason` is the first failing rule; `violations` lists all of them.

```json
{
  "requestId": "doc-8840",
  "userRef": "alice",
  "units": 25,
  "accepted": false,
  "replayed": false,
  "reason": {
    "level": "USER",
    "rule": "MAX_PER_REQUEST",
    "limit": 20,
    "attempted": 25
  },
  "violations": [
    { "level": "USER", "rule": "MAX_PER_REQUEST", "limit": 20, "attempted": 25 }
  ],
  "month": "2026-10",
  "processedAt": "2026-10-18T09:13:40.120Z",
  "account": { "consumed": 340, "remaining": 9660, "...": "LevelStatus" },
  "user": { "consumed": 140, "remaining": 860, "...": "LevelStatus" }
}
```

**Replayed:** the same `requestId` and payload sent again returns the stored decision, `"replayed": true`, with the same
`processedAt` and the state **right after the original decision**. Nothing is counted again, and rejections are replayed too.

**Reason order** when several rules fail: account per-request, user per-request, account monthly, user monthly.

## Usage and history

### `GET /usage?month=2026-10`

Defaults to the current UTC month. Future months return `400`.

```json
{
  "month": "2026-10",
  "account": { "consumed": 350, "remaining": 9650, "...": "LevelStatus" },
  "users": [
    {
      "userRef": "alice",
      "consumed": 150,
      "remaining": 850,
      "...": "LevelStatus"
    },
    {
      "userRef": "bob",
      "consumed": 200,
      "remaining": 19800,
      "...": "LevelStatus"
    }
  ],
  "nextCursor": null
}
```

The account's `consumed` always equals the sum of its users' `consumed` (350 = 150 + 200). For a past month, units
consumed are historical, while `remaining` and the limits use the plans assigned now.

### `GET /users/{userRef}/usage?month=2026-10`

`200 { "month", "user": { ... }, "account": { ... } }`

### `GET /history`

Newest first. Filters (all optional): `userRef`, `month`, `outcome` (`ACCEPTED` or `REJECTED`), plus `limit` and `cursor`.

```json
{
  "items": [
    {
      "requestId": "doc-8840",
      "userRef": "alice",
      "units": 25,
      "outcome": "REJECTED",
      "reason": {
        "level": "USER",
        "rule": "MAX_PER_REQUEST",
        "limit": 20,
        "attempted": 25
      },
      "violations": [{ "...": "Violation" }],
      "month": "2026-10",
      "processedAt": "2026-10-18T09:13:40.120Z",
      "account": { "...": "LevelStatus" },
      "user": { "...": "LevelStatus" }
    }
  ],
  "nextCursor": null
}
```

Each entry's `account` and `user` blocks are the state **at that decision**. Later plan changes never alter them.

## Retry guidance

| You got                              | Do this                                                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A timeout or a `5xx` from `/consume` | Retry with the **same** `requestId` and payload. It is processed once.                                                                                          |
| `409 CONFLICT_ERROR`                 | You reused an id for a different action. Use a new `requestId`.                                                                                                 |
| `accepted: false`                    | Not an error. Do not retry the same request expecting a different answer: a replay returns the same rejection. After a plan change, send a **new** `requestId`. |
| `401`                                | Check the key. A lost key cannot be recovered.                                                                                                                  |
