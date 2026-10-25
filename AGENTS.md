# Agent instructions for ppets_server

Read [development](docs/DEVELOPMENT.md) and a parent AGENTS.md if present. Confirm the repository root and Git status here. Preserve unrelated edits and untracked files; this is separate from ppets_client.

## Architecture and implementation

- NestJS 11, Prisma 6, and MySQL remain the stack. AppModule mounts MVP health, auth, and asset controllers. Legacy modules remain source only; do not mount them incidentally.
- The sibling client's live `/mvp/` calls this API; its preserved demo routes use local mocks.
- Trace strict Zod body/query/parameter validation, policy, services, and Prisma queries together. Keep DatabaseService persistence and the standard `{error:{code,message,requestId}}` contract.
- The global AuthGuard denies routes without a policy. Use shared `can()` and enforce resource ownership/department scope in services. Client-supplied identity, role, and department values are untrusted.
- Authentication uses opaque HttpOnly cookie sessions with only keyed HMAC hashes stored in MySQL. Read current account state on session use; do not reintroduce legacy JWT identity or browser-persisted live tokens.
- Preserve email verification, generic account responses, single-use reset tokens, session revocation, and synchronized password reset/login issuance. Keep private mail stubs and tokens out of logs/public files.
- Preserve atomic stock/status transitions. Test competing approvals/returns and denied operations when changing them.
- Preserve request IDs, JSON request/error logging, security headers, origin checks, and rate limits. The default limiter is process-local, not distributed.

## Environment and database boundaries

Preserve private environment values; never print/commit secrets, database URLs, cookies, or private records. Startup validates configuration; see [.env.example](.env.example) and development. Install uses Prisma postinstall generation; generated clients, dist/, and dist-seed/ are not source.

Before migrations, seeding, or data changes, identify the exact target and whether it is disposable. Destructive operations and shared/production writes require explicit authorization for target and operation. Inspect schema/history first; preserve additive migrations, never rewrite applied history or replace the schema with introspection output.

`seed:mvp` creates a verified admin and sample assets, preserves existing passwords/stock, and refuses to promote a member. Legacy `prisma/seed.ts` is separate and not reliably idempotent. Inspect seeds before use.

## Commands and validation

Run here with Node.js 22 or newer:

| Purpose | PowerShell command |
| --- | --- |
| Locked install and Prisma generation | `npm.cmd ci` |
| Regenerate Prisma client | `npm.cmd run prisma:generate` |
| Strict MVP type checking | `npm.cmd run typecheck` |
| Non-mutating MVP lint | `npm.cmd run lint` |
| Focused MVP tests | `npm.cmd test` |
| Compile API and bootstrap seed | `npm.cmd run build` |
| Development, default port 4001 | `npm.cmd run dev` |
| Apply migrations to agreed target | `npm.cmd run migrate:deploy` |
| Seed agreed target | `npm.cmd run seed:mvp` |
| Configured disposable live API acceptance | `npm.cmd run test:live` |

`tsconfig.mvp.json`, `tsconfig.build.json`, `jest.mvp.config.json`, and `eslint.mvp.config.mjs` define active checks. `lint:legacy` includes --fix; format also writes files. `test:legacy` and `test:e2e` retain earlier setups and are not MVP acceptance; inspect their database dependencies first.

Documentation checks need no services/database actions. Report strict compilation, lint, unit tests, database/API acceptance, and browser acceptance separately; a build proves none of the latter. Update affected guides. Start persistent services only as needed, stop only task-owned processes, and obtain user instructions before pushes/deployments. Never commit unrelated work.