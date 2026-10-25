# PPETS MVP API

NestJS 11, Prisma 6, and MySQL API for verified member accounts and equipment request -> admin approval -> member return. The runtime exposes only the focused MVP controllers; earlier modules remain in source and are not mounted.

Read [AGENTS.md](AGENTS.md) and [development](docs/DEVELOPMENT.md) for setup, environment variables, routes, checks, and migration boundaries.

## Quick setup

From this directory, with Node.js 22 or newer and a dedicated local MySQL database:

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Fill in the private values in `.env`. Inspect your database target and migration state before applying migrations. For a newly created disposable local database:

```powershell
npm.cmd run migrate:deploy
npm.cmd run seed:mvp
npm.cmd run dev
```

The API defaults to port 4001. Set `PORT` to an available port if another service uses it. The sibling workspace's Compose setup starts the complete web/API/database application and generates local secrets without printing them.

## Checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd audit --audit-level=high
```

`npm.cmd run test:live` additionally tests real HTTP auth, reset/login overlap, roles, stock, and concurrent transitions. It requires `MVP_DISPOSABLE_TEST=1`, a dedicated database whose name ends in `_test`, a migrated/seeded schema, and the configured seed admin credentials. It creates fictional test records.

All API errors use `{ error: { code, message, requestId } }`. Logs contain request IDs, method/path/status/duration and server-side exception stacks; request bodies, cookies, and query strings are not logged. `GET /health` reports liveness after successful startup.

Email verification/reset is backed by a private file stub behind `MailSender`. It does not deliver inbox email. The local setup guide explains retrieving those links safely.
