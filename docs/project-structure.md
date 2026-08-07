# Project structure

```text
hooklens/
├── apps/
│   ├── api/                    Fastify REST API and Prisma schema
│   │   ├── prisma/             Schema and committed migrations
│   │   └── src/modules/
│   │       ├── deliveries/     Intake, list/detail, diagnosis, retry and redaction
│   │       └── knowledge/      Parser, ingestion, search and retrieval evaluation
│   ├── mcp/                    MCP Streamable HTTP server
│   │   └── src/modules/        MCP repository, retrieval, diagnosis, retry adapter
│   └── web/                    Next.js administration console
│       └── src/                App routes, query client and UI components
├── knowledge/                  Fictional Markdown integration knowledge base
│   ├── events/                 Event reference documentation
│   ├── security/               Signature and secret-management guidance
│   ├── runbooks/               Operational diagnostic procedures
│   └── postmortems/            Incident learning material
├── docs/                       Project documentation
├── .github/workflows/ci.yml    Pull-request quality workflow
├── docker-compose.yml          Local PostgreSQL + pgvector service
├── .env.example                Safe local environment template
├── package.json                Workspace-level scripts
└── pnpm-workspace.yaml         Workspace packages and approved build scripts
```

## Application packages

### `apps/api`

The API is the browser-facing application boundary. It exposes REST endpoints,
validates request data with Zod, persists operational state through Prisma and
redacts records before sending them to the web application. It owns the retry
transaction, idempotency checks, audit records and retry limit.

The `knowledge` module is also responsible for Markdown parsing, embedding
generation, hybrid search and retrieval evaluation. Tests live next to the
business modules as `*.test.ts`; `tsconfig.test.json` prevents them from being
emitted into the production `dist` directory.

### `apps/mcp`

The MCP process is a separate, loopback-only Streamable HTTP server. It exposes
the same operational data and knowledge through MCP resources, tools and
prompts. Its read repository queries PostgreSQL directly and applies its own
redaction. Its only write-capable tool delegates to the API retry endpoint.

### `apps/web`

The Next.js application contains four focused views: deliveries, delivery
details and diagnosis, knowledge base, and MCP capabilities. TanStack Query
handles browser requests to the Fastify API. The web workspace has no database
or OpenAI credential access.

## Knowledge source layout

Markdown is intentionally stored in the repository to make the RAG corpus
reviewable. Files use frontmatter for title and related event types, then
heading-based sections become chunks during ingestion. Adding a document is a
content change: run a dry-run first, then ingest it to update PostgreSQL.

## Generated and local files

The following are intentionally ignored by Git:

| Path or pattern                 | Reason                                                   |
| ------------------------------- | -------------------------------------------------------- |
| `node_modules/`, `.pnpm-store/` | Downloaded dependencies and package cache.               |
| `.next/`, `dist/`, `coverage/`  | Generated build and test outputs.                        |
| `.env`, `.env.local`            | Local connection strings and API keys.                   |
| Docker volume                   | PostgreSQL data managed by Docker, not repository files. |

The authoritative dependency lockfile is the root `pnpm-lock.yaml`. Do not
generate or update a second lockfile with npm in this pnpm workspace.

## Related documents

- [Architecture](architecture.md)
- [Operations and commands](operations.md)
- [Technical decisions](technical-decisions.md)
