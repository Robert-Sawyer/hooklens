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

**Stage 9 adds the HookLens administrative console.** The Next.js interface
shows redacted delivery data, evidence-based diagnosis, ingested knowledge and
the MCP capabilities in one local operational workspace. A retry remains an
explicitly confirmed operator action.

1. In PowerShell, run `Copy-Item .env.example .env`.
2. Run `pnpm install`.
3. Ensure Docker Desktop is running, then run `pnpm db:up`.
4. Run `pnpm db:generate && pnpm db:migrate`.
5. Run `pnpm db:seed` to add the deterministic demo deliveries.
6. Add `OPENAI_API_KEY` to the local `.env` before running real knowledge ingest.
7. Run `pnpm knowledge:ingest -- --dry-run` to validate Markdown files without API calls.
8. Run `pnpm knowledge:ingest` to store embeddings in the local database.
9. Run `pnpm db:migrate` to add the full-text-search index.
10. Run `pnpm eval:retrieval` to measure retrieval quality against the fixed fixture.
11. Run `pnpm dev`, then open `http://localhost:4000/health`.
12. In a second terminal, run `pnpm web:dev`, then open `http://127.0.0.1:3000/deliveries`.
13. Optionally, in a third terminal run `pnpm mcp:dev`, then open `http://127.0.0.1:4001/health`.
14. Run `pnpm check && pnpm build`.

The Prisma commands use Node 22 to read `DATABASE_URL` directly from the root
`.env` file, so the first step must be completed before generating the client or
applying migrations. The project maps its container to port `5433` to avoid
colliding with a local PostgreSQL instance on the standard port `5432`.

## Useful commands

| Command                              | Purpose                                          |
| ------------------------------------ | ------------------------------------------------ |
| `pnpm check`                         | Check formatting for the current stage           |
| `pnpm dev`                           | Run the minimal Fastify API at port 4000         |
| `pnpm web:dev`                       | Run the Next.js admin console at port 3000       |
| `pnpm web:start`                     | Run the compiled Next.js admin console           |
| `pnpm mcp:dev`                       | Run the local MCP server at port 4001            |
| `pnpm mcp:start`                     | Run the compiled MCP server                      |
| `pnpm build`                         | Compile the API, MCP server and admin console    |
| `pnpm db:up`                         | Start the local PostgreSQL + pgvector container  |
| `pnpm db:down`                       | Stop the local database container                |
| `pnpm db:generate`                   | Generate the Prisma Client from the schema       |
| `pnpm db:migrate`                    | Apply committed Prisma migrations                |
| `pnpm db:seed`                       | Add or refresh deterministic API demo data       |
| `pnpm knowledge:ingest -- --dry-run` | Parse Markdown without writing or calling OpenAI |
| `pnpm knowledge:ingest`              | Generate embeddings and store knowledge chunks   |
| `pnpm eval:retrieval`                | Measure top-3 retrieval quality and latency      |

## Docker cleanup after a day of work

For normal daily shutdown, stop only the HookLens database. Its PostgreSQL
volume remains intact, so the next day you can start where you finished:

```powershell
pnpm db:down
docker system df -v
```

`pnpm db:down` removes the HookLens container and network, but deliberately
keeps the database volume and pulled image. It therefore saves little disk
space by itself. Use `docker system df -v` first to see whether images,
containers, volumes or build cache are actually using the space.

When Docker reports unused cache or dangling images, these commands are safe
for the HookLens database but can remove unused cache or images from other local
projects too:

```powershell
docker builder prune -f
docker image prune -f
```

To completely reset only HookLens's local database, run the following from the
repository root. This permanently removes its PostgreSQL data; on the next run
you must execute `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed` and
`pnpm knowledge:ingest` again.

```powershell
docker compose down --volumes
```

Avoid using this as a daily command:

```powershell
docker system prune -a --volumes
```

It removes every unused Docker image, stopped container, network, build cache
and unused volume across all your projects. Docker Desktop stores these objects
inside its disk image, so if disk C remains large after cleanup, inspect Docker
Desktop settings and move the **Disk image location** to drive E rather than
moving Docker files manually. See the official [Docker cleanup guide](https://docs.docker.com/engine/manage-resources/pruning/)
and [Docker Desktop settings](https://docs.docker.com/desktop/settings-and-maintenance/settings/).

## Day 3 API

The API runs at `http://localhost:4000`.

| Method | Path                                       | Purpose                                                                  |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| `POST` | `/api/v1/webhooks`                         | Record an event, a delivery and its first attempt.                       |
| `GET`  | `/api/v1/deliveries`                       | List deliveries; accepts `page`, `pageSize`, `status` and `eventType`.   |
| `GET`  | `/api/v1/deliveries/:deliveryId`           | Return a delivery, its source event and all attempts.                    |
| `POST` | `/api/v1/deliveries/:deliveryId/retry`     | Queue a guarded retry request for a failed delivery.                     |
| `POST` | `/api/v1/deliveries/:deliveryId/diagnosis` | Retrieve knowledge and generate a source-backed diagnosis for a failure. |
| `GET`  | `/api/v1/knowledge/documents`              | List ingested documents; accepts an optional `category` filter.          |
| `GET`  | `/api/v1/knowledge/documents/:documentId`  | Return an ingested document with its ordered chunks.                     |

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

## Day 5 knowledge ingestion

The `knowledge/` directory contains eleven fictional integration documents:
event references, security guides, operational runbooks, and postmortems. Each
document has frontmatter with its title and related event types. The ingest
pipeline divides a document into heading-based chunks and preserves the source
title, section, category, checksum, and event metadata.

Run the parser safely before using the API:

```powershell
pnpm knowledge:ingest -- --dry-run
```

For the real ingest, add this only to your ignored local `.env` file:

```text
OPENAI_API_KEY="your-project-key"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

Then run:

```powershell
pnpm knowledge:ingest
```

The default model produces 1536-dimensional vectors, matching the pgvector
column and HNSW index. Re-running the command skips documents whose checksum,
embedding model, and chunk count have not changed. Never commit an API key or
place it in frontend code.

## Day 6 hybrid retrieval and diagnosis

The `searchKnowledge` service combines two independent rankings: semantic
similarity from pgvector and PostgreSQL full-text search. It fuses them with
reciprocal-rank fusion, then returns the strongest chunks with the document,
section and category metadata. The database has both the existing HNSW vector
index and a GIN full-text index.

The diagnosis endpoint accepts failed deliveries only. It uses their event
type, HTTP status, receiver response and attempt history to create a retrieval
query. It never queues a retry. API sources are created from the retrieved
chunks, not generated by the language model.

The model receives a redacted diagnostic context. `Authorization`, tokens,
secrets, signatures, cookies and similarly named payload fields are replaced
before the API call. The payload is omitted by default; pass
`?includePayload=true` only when it is needed for diagnosis and still treat it
as redacted context.

Add the diagnosis model setting to your ignored local `.env` file. It may be
overridden if your OpenAI project uses a different model:

```text
OPENAI_DIAGNOSIS_MODEL="gpt-5.6-terra"
```

With the database running and knowledge already ingested, run the fixed
retrieval evaluation:

```powershell
pnpm db:migrate
pnpm eval:retrieval
```

The command evaluates six source questions and one deliberately unanswerable
question. It prints top-3 hit rate, no-answer checks and average latency, then
returns a non-zero code if the hit rate drops below 80% or the no-answer check
fails. This gives later changes to chunking, prompts and retrieval a small,
repeatable regression signal.

Example diagnosis for the seeded `401 Invalid signature` delivery:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/v1/deliveries/20000000-0000-4000-8000-000000000001/diagnosis"
```

The response includes the diagnosis text and a deterministic `sources` list.
It returns `409 DELIVERY_NOT_FAILED` for delivered or pending webhooks, and
`503 DIAGNOSIS_UNAVAILABLE` when the AI service is not configured or reachable.

## Day 7 MCP read-only foundation

`apps/mcp` is a separate Model Context Protocol server. It uses the official
TypeScript SDK and Streamable HTTP on `http://127.0.0.1:4001/mcp`. For the
local portfolio demo it accepts connections only from loopback hosts and
validates the `Host` and browser `Origin` headers before handling an MCP
request.

Start the API and MCP server in separate terminals:

```powershell
pnpm dev
pnpm mcp:dev
```

Then check the MCP process independently:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:4001/health"
```

Configure a compatible MCP client with the Streamable HTTP URL
`http://127.0.0.1:4001/mcp`. Exact configuration syntax differs by client, but
the server exposes these stable, discoverable capabilities:

| Kind     | Name or URI                          | Purpose                                                |
| -------- | ------------------------------------ | ------------------------------------------------------ |
| Resource | `hooklens://deliveries/{deliveryId}` | Redacted delivery, event and attempt history.          |
| Resource | `hooklens://events/{eventId}`        | Redacted event and summary of linked deliveries.       |
| Resource | `hooklens://documents/{documentId}`  | Ingested documentation, runbook or postmortem chunks.  |
| Resource | `hooklens://runbooks/{runbookId}`    | Ingested runbook chunks only.                          |
| Tool     | `get_delivery_details`               | Read a redacted delivery and attempts.                 |
| Tool     | `get_webhook_event`                  | Read a redacted event and delivery summary.            |
| Tool     | `get_delivery_attempts`              | Read one delivery's attempt history.                   |
| Tool     | `get_knowledge_document`             | Read an ingested knowledge document.                   |
| Tool     | `search_knowledge`                   | Hybrid-search documentation, runbooks and postmortems. |
| Tool     | `find_relevant_runbook`              | Search only operational runbooks.                      |
| Tool     | `diagnose_delivery_failure`          | Generate a redacted diagnosis with cited sources.      |
| Tool     | `retry_webhook_delivery`             | Queue a separately confirmed retry.                    |
| Prompt   | `diagnose-webhook-failure`           | Guide evidence-based delivery diagnosis.               |
| Prompt   | `prepare-integration-checklist`      | Prepare a sourced checklist for an event type.         |
| Prompt   | `review-retry-storm`                 | Investigate retry-storm symptoms without retrying.     |

All tool inputs are validated before use. Sensitive headers and payload fields
whose names indicate credentials, secrets, tokens, cookies or signatures are
masked.

## Day 8 MCP diagnostics and guarded retry

The MCP server now runs the same hybrid knowledge search as the API, including
event-type and category filters. `diagnose_delivery_failure` retrieves relevant
knowledge, provides redacted delivery context to the model, and returns the
model response with deterministic document and section sources. Payload data is
excluded by default and remains redacted when explicitly included.

The three MCP prompts are reusable workflows for compatible AI clients. They
instruct the client to gather evidence first, cite sources and never retry a
webhook as part of diagnosis.

`retry_webhook_delivery` is the only write tool. It requires all of:

- explicit `confirmed: true` from the client after the user approves the retry;
- a new UUID `idempotencyKey`;
- a local API process running at `MCP_API_URL`;
- `MCP_OPERATOR_ENABLED=true` in the ignored local `.env` file.

The tool delegates to the existing API retry endpoint instead of duplicating
business rules. That preserves its role check, delivery-state check, three-retry
limit, idempotency and audit log. It only queues a pending attempt; it does not
perform an external webhook HTTP request. Leave `MCP_OPERATOR_ENABLED=false` for
normal read-only use. This environment flag is a portfolio-demo permission
boundary, not production authentication; a production deployment needs real
identity and authorization controls.

## Day 9 Next.js admin console

`apps/web` is a standalone Next.js application that uses Tailwind CSS and
TanStack Query to call the Fastify API. It is intentionally a separate
workspace app: the browser never receives a database connection, embedding API
key or MCP operator flag.

Start the local operational console alongside the API:

```powershell
pnpm dev
pnpm web:dev
```

Then open `http://127.0.0.1:3000/deliveries`. The console has four portfolio
views:

- **Deliveries** — paginated list with status and event-type filters.
- **Delivery details** — masked request data, receiver response, attempt
  timeline, sourced AI diagnosis and a separately confirmed local retry.
- **Knowledge** — document category filter, embedding status and stored
  heading chunks.
- **MCP** — a concise inventory of the server resources, tools and prompts.

The API now permits browser requests only from the comma-separated origins in
`WEB_ORIGIN`; its local default accepts `http://localhost:3000` and
`http://127.0.0.1:3000`. The optional browser-facing API base URL is
`NEXT_PUBLIC_API_URL`, defaulting to `http://127.0.0.1:4000`. Values beginning
with `NEXT_PUBLIC_` are bundled into browser code, so only a non-secret URL may
be placed there.

`pnpm web:dev` and `pnpm build` prepare Next.js's generated route-type file for
their respective mode before starting. This avoids a Windows `EPERM` collision
when Next.js switches between `.next/dev` and production type declarations.

Before delivery data reaches the browser, the API masks credential-shaped
headers and payload fields, receiver response secrets and URL query strings.
This repeats the existing safety boundary at the web API, instead of relying on
the UI to hide sensitive data. The retry button sends the development-only
operator header only after the user checks an explicit confirmation box; it
still invokes the original API guard and never sends an outbound webhook.

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

### Day 5 - Knowledge ingestion

- Added eleven Markdown knowledge documents across events, security, runbooks,
  and postmortems.
- Added heading-based chunking, frontmatter metadata extraction, checksums and
  a dry-run command that needs neither the database nor an OpenAI key.
- Added OpenAI embedding generation and pgvector storage with a 1536-dimension
  HNSW cosine-similarity index.
- Next: add hybrid retrieval, source-backed failure diagnosis and retrieval
  evaluation.

### Day 6 - Hybrid retrieval and diagnosis

- Added pgvector-plus-full-text hybrid search with document category and event
  type filters, then fused both rankings before returning chunks.
- Added a read-only, source-backed diagnosis endpoint for failed deliveries.
  Its model context masks sensitive headers and secret-shaped payload values.
- Added a fixed retrieval-evaluation fixture, no-answer check and
  `pnpm eval:retrieval` regression command.
- Next: expose the same read-only operations through an MCP server.

### Day 7 - MCP read-only foundation

- Added a separate `apps/mcp` Streamable HTTP server using the official MCP
  TypeScript SDK and local host/origin validation.
- Added redacted delivery, event, knowledge-document and runbook resources,
  together with four Zod-validated read-only tools.
- Kept all write operations, including webhook retry, outside the MCP server
  until a separate confirmation flow is added.
- Next: add MCP knowledge search, diagnosis prompts and guarded retry.

### Day 8 - MCP diagnosis and guarded retry

- Added MCP knowledge search, runbook retrieval and source-backed delivery
  diagnosis with the existing embedding, PostgreSQL and OpenAI setup.
- Added three reusable MCP prompts that keep diagnosis evidence-based and
  prohibit automatic retry.
- Added the separately confirmed MCP retry tool, which delegates to the API so
  role checks, idempotency, retry limits and the audit log remain consistent.
- Documented normal Docker shutdown, targeted cleanup, full HookLens database
  reset and the risks of global Docker pruning.
- Next: build the Next.js administrative interface for deliveries, diagnosis,
  knowledge and MCP capabilities.

### Day 9 - Administrative console

- Added the separate Next.js web workspace with Tailwind CSS and TanStack
  Query, plus shared root commands to run, check and build it.
- Added deliveries, delivery-detail, diagnosis, safe-retry, knowledge-base and
  MCP-capabilities views, all backed by the existing Fastify API.
- Added read-only knowledge-document endpoints, local CORS configuration and
  API-boundary redaction for delivery data shown in a browser.
- Verified the API health, seeded delivery list and knowledge list responses,
  TypeScript checks for API and web, and a production Next.js build.
- Next: add unit coverage, an end-to-end Cypress scenario, screenshots and CI
  checks for the portfolio workflow.

## Development-log template

Add a short entry with every daily GitHub update:

```md
### Day N — concise outcome

- What changed.
- What was verified.
- Next: the next small deliverable.
```
