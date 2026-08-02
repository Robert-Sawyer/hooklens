# HookLens

HookLens will be a webhook observability console for integration teams. It will
combine delivery data, retrieval-augmented documentation, safe retries and an
MCP server so that humans and AI clients investigate the same operational source
of truth.

## Planned MVP

- Webhook intake and delivery-attempt history in PostgreSQL.
- RAG diagnosis over Markdown documentation, runbooks and postmortems.
- `pgvector` HNSW search combined with PostgreSQL full-text search.
- A guarded retry flow, Streamable HTTP MCP server and Next.js admin panel.

## Architecture

See [architecture documentation](docs/architecture.md). The local system consists
of `apps/web` (Next.js), `apps/api` (Fastify), `apps/mcp` (MCP Streamable HTTP),
PostgreSQL with pgvector, and Markdown source files in `knowledge/`.

## Current stage

**Stage 2 adds the data model.** Prisma now defines webhook events, deliveries
and individual delivery attempts. The migration enables pgvector and creates the
initial PostgreSQL tables and indexes. Webhook endpoints, RAG, MCP and UI remain
intentionally out of scope for this branch.

1. In PowerShell, run `Copy-Item .env.example .env`.
2. Run `pnpm install`.
3. Run `pnpm dev`, then open `http://localhost:4000/health`.
4. Ensure Docker Desktop is running, then run `pnpm db:up`.
5. Run `pnpm db:generate && pnpm db:migrate`.
6. Run `pnpm check && pnpm build`.

The Prisma commands use Node 22 to read `DATABASE_URL` directly from the root
`.env` file, so the first step must be completed before generating the client or
applying migrations. The project maps its container to port `5433` to avoid
colliding with a local PostgreSQL instance on the standard port `5432`.

## Useful commands

| Command            | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `pnpm check`       | Check formatting for the current stage          |
| `pnpm dev`         | Run the minimal Fastify API at port 4000        |
| `pnpm build`       | Compile the current API                         |
| `pnpm db:up`       | Start the local PostgreSQL + pgvector container |
| `pnpm db:down`     | Stop the local database container               |
| `pnpm db:generate` | Generate the Prisma Client from the schema      |
| `pnpm db:migrate`  | Apply committed Prisma migrations               |

## Delivery plan and development log

### Stage 1 — Foundation (complete)

- Created the pnpm workspace, Docker Compose, CI and architecture documentation.
- Added environment defaults that make the project safe and runnable offline.

The remaining stages, their exact scope and proposed commit messages are in
[the roadmap](docs/roadmap.md). Each stage will be implemented only after the
previous one is committed.

## Target security decisions

- `viewer` reads data; only `operator` may retry.
- Retry needs `confirmed: true`, a UUID idempotency key and an unfinished failure.
- Sensitive headers and common secret-shaped payload fields are redacted at the API boundary.
- Live outbound delivery is disabled by default and host allow-listed when enabled.
- MCP retry asks for explicit confirmation; diagnostic tools are read-only.

## Development log

### Day 1 — Foundation

- Created the pnpm workspace, PostgreSQL + pgvector Compose service and basic CI.
- Added a minimal Fastify API with `GET /health`.
- Documented the target architecture and the small, sequential delivery plan.
- Next: model the webhook and delivery tables with Prisma.

### Day 2 - Data model

- Added Prisma, the PostgreSQL schema and a committed migration.
- Modelled `WebhookEvent`, `WebhookDelivery` and `DeliveryAttempt`, including
  delivery state, event relations, attempt ordering and query indexes.
- Enabled the pgvector extension now; embedding tables are deliberately planned
  for the later RAG stage.
- Mapped the development database to port `5433` to avoid a local PostgreSQL
  collision on port `5432`.
- Made every Prisma command load the root `.env` through Node 22, without
  relying on a separate `dotenv` executable.
- Verified Prisma Client generation, TypeScript compilation and migration status
  against the local Docker PostgreSQL instance on port `5433`.
- Next: receive webhooks and expose delivery list/detail API endpoints.

## Development-log template

Add a short entry with every daily GitHub update:

```md
### Day N — concise outcome

- What changed.
- What was verified.
- Next: the next small deliverable.
```
