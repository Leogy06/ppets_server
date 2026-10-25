# Server development

## Runtime and repository boundaries

Read [AGENTS.md](../AGENTS.md) before editing. The active runtime wires `HealthController`, `AuthController`, and `AssetsController` in `src/app.module.ts`. Earlier modules remain as legacy source but are not imported by the MVP bootstrap.

The real client lives at `/mvp/` and calls this API. Existing demo pages continue using local mock data. The backend stack remains NestJS 11, Prisma 6, and MySQL; no PostgreSQL or Swagger setup is present.

## Setup and environment

Use Node.js 22 or newer. Run `npm.cmd ci` inside `ppets_server/`; postinstall generates the Prisma client. Copy [.env.example](../.env.example) to a private `.env` and set:

| Variable | Purpose/default |
| --- | --- |
| `DATABASE_URL` | Required MySQL URL for the intended local target |
| `CLIENT_BASEURL` | Required comma-separated exact browser origins, without trailing paths |
| `SESSION_SECRET` | Required random secret, at least 32 characters, for keyed token hashes |
| `PORT` | API port; default 4001 |
| `NODE_ENV` | development/test/production; production enables Secure cookies |
| `SESSION_TTL_HOURS` | Opaque session lifetime; default 24, maximum 168 |
| `AUTH_RATE_LIMIT` | Shared auth requests per client/window; default 10 |
| `API_RATE_LIMIT` | Other API requests per client/window; default 120 |
| `RATE_WINDOW_SECONDS` | Fixed rate window; default 60 |
| `TRUST_PROXY` | Explicit true/false (or 1/0); default false |
| `EMAIL_MODE` | stub |
| `EMAIL_STUB_DIR` | Private message directory; default .local-mail |
| `SEED_ADMIN_EMAIL` | Required by bootstrap seed, not normal API requests |
| `SEED_ADMIN_PASSWORD` | Seed password: at least 12 characters, at most 72 UTF-8 bytes |

Missing or invalid startup configuration fails before listening, without logging values. Set `TRUST_PROXY=true` only behind the intended final proxy hop with direct API access restricted. Compose does this on its private network; nginx replaces forwarded identity headers.

Before database work, identify the exact target and inspect `prisma/schema.prisma`, `prisma/migrations/`, and existing migration state. For a newly created disposable local database:

```powershell
npm.cmd run migrate:deploy
npm.cmd run seed:mvp
npm.cmd run dev
```

The new migration is additive. Existing accounts are not silently verified. The MVP seed creates one verified admin and three fictional office assets; reruns preserve existing passwords and stock and refuse to promote a member. The older `prisma/seed.ts` is separate and is not the MVP bootstrap.

## API contract

Every route validates body, query, and path parameters with strict Zod schemas. Unknown fields are rejected.

| Route | Access/purpose |
| --- | --- |
| GET /health | Public liveness |
| POST /api/auth/signup | Public; name/email/password, always creates member |
| POST /api/auth/verify-email | Public; single-use token |
| POST /api/auth/login | Public; email/password, sets HttpOnly session cookie |
| POST /api/auth/logout | Idempotent; revokes presented session and clears cookie |
| GET /api/auth/session | Authenticated safe user/role |
| POST /api/auth/forgot-password | Public generic recovery response |
| POST /api/auth/reset-password | Public; token/password, revokes sessions |
| GET /api/assets | Authenticated; page/limit/search |
| GET /api/summary | Authenticated; scoped catalog, available, pending, assigned and returned totals |
| GET /api/requests | Own requests for member; department requests for admin; page/limit/status |
| POST /api/requests | Member; assetId/quantity/reason |
| POST /api/requests/:id/approve | Admin |
| POST /api/requests/:id/reject | Admin; pending only, stock unchanged |
| POST /api/requests/:id/cancel | Request's member owner; pending only, stock unchanged |
| POST /api/requests/:id/return | Request's member owner |

List responses use `{items,total,page,limit}`. Pages start at 1, limits default to 10 and cannot exceed 50. Request statuses retain the schema's PENDING/APPROVED/RETURNED/REJECTED/CANCEL values. Request, approve, reject, cancel and return are explicit guarded transitions. Responses include nullable `reviewedAt` and `returnedAt` timestamps. Summary totals are independent of pagination; available units exclude repair, maintenance and nonpositive stock.

All API errors use `{error:{code,message,requestId}}`, with the same ID in `x-request-id`. Rate-limit responses add `Retry-After`. Do not log bodies, headers, cookie values, or query strings.

## Authentication and policy

Roles are admin/member in API responses, mapped to existing database roles 1/2. The global guard denies routes without explicit policy metadata and calls the shared `can(user,action,resource)`. Services also enforce resource ownership/scope. Signup never accepts a role, employee ID, or department.

Passwords use bcrypt. Session and one-time token values are cryptographically random; only HMAC hashes are stored. Verification lasts 24 hours, reset 30 minutes. Both are consumed atomically. Password reset revokes all sessions and other reset tokens; session issuance locks/rechecks the user so an overlapping old-password login cannot bypass reset.

Repeating signup for an active, unverified member atomically replaces the pending password and verification intent under a user-row lock. Earlier verification links become invalid. Verification uses the same lock order, preventing a pre-registered password from being activated by a later legitimate signup. Existing verified, inactive, archived or admin accounts remain unchanged.

`MailSender` is an interface. `FileMailSender` writes private JSON files containing to/purpose/url into `EMAIL_STUB_DIR`; it never returns links from public endpoints or logs tokens. Inspect those files locally for development. A real mail provider remains a deliberate follow-up.

## Source map

- `src/core/`: validated config, errors, strict validation, policies/guard, HTTP logging, security headers, swappable rate-limit store.
- `src/mvp/auth.*`, `src/mvp/mail.ts`: authentication and email interface.
- `src/mvp/assets.*`: list and request/approval/return behavior.
- `src/database/database.service.ts`: Prisma lifecycle.
- `prisma/schema.prisma`, migrations, `seed-mvp.ts`: MySQL model/history/bootstrap.
- `test/mvp/live-auth.ts`, `live-flow.ts`: opt-in disposable-database acceptance.

Stock transitions use conditional status claims and atomic quantity changes inside transactions. Concurrent approvals cannot allocate more than available stock; a return increments stock once. Conflicts return 409 and can be retried after refresh.

## Checks and build

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd audit --audit-level=high
```

Lint is non-mutating. `format` intentionally writes the MVP files. Strict type checking uses `tsconfig.mvp.json`; build emits the API to `dist/` and bootstrap seed to `dist-seed/`. `start:prod` starts the compiled API. Legacy lint/tests are explicit separate scripts, not proof of MVP behavior.

For real acceptance, configure a migrated/seeded disposable database ending in `_test`, set `MVP_DISPOSABLE_TEST=1` and seed admin credentials, then run `npm.cmd run test:live`. It creates fictional accounts/requests. Never run it against shared or production data.

Both projects have CI workflows. Local tests/builds do not establish deployed cookie/CORS, actual inbox delivery, or successful GitHub execution. Docker startup runs migrations/seed against its dedicated local volume only; applying changes to an existing deployment requires its own target review.
