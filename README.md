# HookLens

HookLens is a portfolio project for investigating failed webhook deliveries. It
combines operational delivery data, integration documentation, retrieval
augmented generation (RAG), and an MCP server so that a web user and an AI
client work with the same evidence.

## Run locally

The commands below use Windows PowerShell. On Windows, use `pnpm.cmd` if the
PowerShell execution policy blocks `pnpm.ps1`; on macOS or Linux, replace it
with `pnpm`.

### Prerequisites

- Node.js 22 or newer;
- pnpm 11.17.0 (the repository declares the exact package-manager version);
- Docker Desktop running locally;
- an OpenAI API key only for live knowledge ingestion, RAG search and AI
  diagnosis. The basic delivery UI and API do not require one.

### Start the basic local demo

```powershell
git clone https://github.com/Robert-Sawyer/hooklens.git
cd hooklens

Copy-Item .env.example .env
pnpm.cmd install
pnpm.cmd db:up
pnpm.cmd db:generate
pnpm.cmd db:migrate
pnpm.cmd db:seed
```

Start the API and web application in two separate terminals:

```powershell
pnpm.cmd dev
```

```powershell
pnpm.cmd web:dev
```

Open these addresses:

| Service          | Address                                   |
| ---------------- | ----------------------------------------- |
| Admin console    | <http://127.0.0.1:3000/deliveries>        |
| API health check | <http://127.0.0.1:4000/health>            |
| Delivery API     | <http://127.0.0.1:4000/api/v1/deliveries> |

The seed creates three deterministic delivery examples. The first one is a
failed `payment.completed` webhook with `401 Invalid signature`, intended for
the diagnosis walkthrough.

### Enable the full RAG demo

Add a valid key only to the ignored `.env` file:

```text
OPENAI_API_KEY="your-project-key"
```

Then validate and ingest the Markdown knowledge base:

```powershell
pnpm.cmd knowledge:ingest -- --dry-run
pnpm.cmd knowledge:ingest
pnpm.cmd eval:retrieval
```

After ingestion, open the failed seeded delivery and use **AI diagnosis**. The
application retrieves relevant documentation and runbooks, sends a redacted
context to the model, and returns the answer with deterministic sources.

### Start MCP locally (optional)

With the database running, start the MCP server in a third terminal:

```powershell
pnpm.cmd mcp:dev
```

Its health endpoint is <http://127.0.0.1:4001/health> and its Streamable HTTP
endpoint for a compatible MCP client is `http://127.0.0.1:4001/mcp`.

### Verify the project

```powershell
pnpm.cmd test
pnpm.cmd check
pnpm.cmd build
```

`test` runs API unit tests and web component tests without Docker, PostgreSQL
or an OpenAI key. `check` validates formatting and TypeScript across the
workspace; `build` produces the API, MCP and Next.js builds.

## Stop, clean up and reset local state

Stop the API, web and MCP terminals with `Ctrl+C`. To stop only HookLens
containers while keeping the PostgreSQL data for tomorrow, run:

```powershell
pnpm.cmd db:down
docker system df -v
```

To reclaim unused Docker build cache or dangling images across Docker Desktop:

```powershell
docker builder prune -f
docker image prune -f
```

To permanently remove **only the HookLens database volume**, run:

```powershell
docker compose down --volumes
```

This deletes all local events, deliveries, retry audits and ingested knowledge.
To recreate the demo afterwards, run `pnpm.cmd db:up`, `pnpm.cmd db:migrate`,
`pnpm.cmd db:seed`, and, when needed, `pnpm.cmd knowledge:ingest`. Avoid
`docker system prune -a --volumes` unless you intentionally want to affect all
local Docker projects. See [operations and troubleshooting](docs/operations.md)
for the full lifecycle and Windows-specific notes.

## What the project demonstrates

- webhook intake, delivery history and a safe, auditable retry workflow;
- RAG over Markdown integration documentation, runbooks and postmortems;
- PostgreSQL full-text search combined with pgvector HNSW semantic search;
- source-backed AI diagnosis with data redaction before the model call;
- an MCP Streamable HTTP server with resources, tools and reusable prompts;
- a Next.js administration console plus automated API tests and pull-request
  quality checks.

The retry operation deliberately queues a new `pending` attempt and audit record
but does **not** send an outbound webhook. It is a safe portfolio boundary, not
a production delivery worker.

## Documentation

| Document                                           | What it covers                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)               | Components, data flows, ports and ownership boundaries.                |
| [Project structure](docs/project-structure.md)     | Repository layout and responsibilities of each module.                 |
| [Operations](docs/operations.md)                   | Commands, environment variables, Docker lifecycle and troubleshooting. |
| [API and MCP reference](docs/api-and-mcp.md)       | REST endpoints, MCP resources, tools, prompts and local setup.         |
| [Technical decisions](docs/technical-decisions.md) | Design trade-offs for technical recruiters and reviewers.              |
| [Development log](docs/development-log.md)         | Chronological record of each delivery day and verification.            |
| [Roadmap](docs/roadmap.md)                         | Completed stages and the remaining portfolio-quality work.             |

## Safety note

This project uses fictional webhook data and documentation. Never put real
tokens, webhook secrets or production payloads in the repository, screenshots
or `.env.example`.
