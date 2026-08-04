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

**Stage 4 adds a guarded retry request.** An operator can queue one new,
pending attempt for a failed delivery only after explicit confirmation. Each
decision is auditable and protected with an idempotency key. Outbound HTTP
delivery remains intentionally disabled.

1. In PowerShell, run `Copy-Item .env.example .env`.
2. Run `pnpm install`.
3. Ensure Docker Desktop is running, then run `pnpm db:up`.
4. Run `pnpm db:generate && pnpm db:migrate`.
5. Run `pnpm db:seed` to add the deterministic demo deliveries.
6. Run `pnpm dev`, then open `http://localhost:4000/health`.
7. Run `pnpm check && pnpm build`.

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
| `pnpm db:seed`     | Add or refresh deterministic API demo data      |

## Day 3 API

The API runs at `http://localhost:4000`.

| Method | Path                                   | Purpose                                                                |
| ------ | -------------------------------------- | ---------------------------------------------------------------------- |
| `POST` | `/api/v1/webhooks`                     | Record an event, a delivery and its first attempt.                     |
| `GET`  | `/api/v1/deliveries`                   | List deliveries; accepts `page`, `pageSize`, `status` and `eventType`. |
| `GET`  | `/api/v1/deliveries/:deliveryId`       | Return a delivery, its source event and all attempts.                  |
| `POST` | `/api/v1/deliveries/:deliveryId/retry` | Queue a guarded retry request for a failed delivery.                   |

Example intake request in PowerShell:

```powershell
$body = @{
  eventType = "payment.completed"
  payload = @{ paymentId = "pay_local_001"; amount = 4999; currency = "PLN" }
  targetUrl = "https://receiver.example.test/hooks/payments"
  requestHeaders = @{ "content-type" = "application/json" }
  attempt = @{ status = "failed"; httpStatus = 401; responseBody = "Invalid signature"; durationMs = 118 }
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/v1/webhooks" -ContentType "application/json" -Body $body
```

The seed command creates three idempotent examples, including the `401 Invalid
signature` scenario used in the later RAG diagnosis work. Copy a delivery ID
from `GET /api/v1/deliveries` and use it in the detail URL.

## Day 4 retry safety

The retry endpoint records a request and adds a `pending` attempt; it does not
call the target URL. This keeps the local demo safe while making the retry
workflow visible and auditable.

For the development-only role check, send `x-hooklens-role: operator`. A missing
or different value is treated as the read-only `viewer` role. A production
identity provider replaces this temporary header in a later stage.

```powershell
$headers = @{ "x-hooklens-role" = "operator" }
$body = @{ confirmed = $true; idempotencyKey = "6d6a1545-5993-43bb-b5c3-6b27fb9835d1" } | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/v1/deliveries/20000000-0000-4000-8000-000000000001/retry" -Headers $headers -ContentType "application/json" -Body $body
```

The same idempotency key for the same delivery returns the original outcome
without creating another attempt. The API rejects retries from viewers, missing
confirmation, successful or pending deliveries, and deliveries that already
reached the limit of three retries. Delivery details include `retryAudits`.

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

### Day 3 - Webhook intake and delivery queries

- Added Zod-validated intake, paginated delivery listing and delivery-detail
  endpoints to the Fastify API.
- Added a Prisma repository so database reads and writes remain outside route
  handlers, together with an idempotent seed script for realistic delivery
  scenarios.
- Added API usage examples and the `pnpm db:seed` command to this README.
- Next: add a guarded, auditable retry workflow for operators.

### Day 4 - Safe retry workflow

- Added an audit trail and idempotency constraint for retry requests.
- Added the operator-only retry endpoint with explicit confirmation, delivery
  state checks and a maximum of three retries.
- Queued retries create a new `pending` attempt; no external HTTP call is made.
- Made the seed reset its demo deliveries and retry audit history so retry
  examples are repeatable.
- Next: ingest Markdown knowledge documents and store their embeddings.

## Development-log template

Add a short entry with every daily GitHub update:

```md
### Day N — concise outcome

- What changed.
- What was verified.
- Next: the next small deliverable.
```
