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

**Stage 1 is intentionally small and commit-ready.** It provides the workspace,
PostgreSQL + pgvector Docker service, baseline CI and a minimal Fastify API with
`GET /health`. It does not yet contain webhook domain logic, RAG, MCP or UI.

1. Copy `.env.example` to `.env`.
2. Run `pnpm install`.
3. Run `pnpm dev`, then open `http://localhost:4000/health`.
4. Optionally run `pnpm db:up` to verify the database container.
5. Run `pnpm check && pnpm build`.

## Useful commands

| Command        | Purpose                                         |
| -------------- | ----------------------------------------------- |
| `pnpm check`   | Check formatting for the current stage          |
| `pnpm dev`     | Run the minimal Fastify API at port 4000        |
| `pnpm build`   | Compile the current API                         |
| `pnpm db:up`   | Start the local PostgreSQL + pgvector container |
| `pnpm db:down` | Stop the local database container               |

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

## Development-log template

Add a short entry with every daily GitHub update:

```md
### Day N — concise outcome

- What changed.
- What was verified.
- Next: the next small deliverable.
```
