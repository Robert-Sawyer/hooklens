# HookLens delivery roadmap

Each stage is intentionally small enough for one focused GitHub commit. Do not
start a later stage before the current commit is reviewed and pushed.

| Stage | Deliverable                                                                           | Suggested commit                                              |
| ----- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1     | Workspace, basic API packages, Fastify `GET /health`, pgvector Compose, CI and README | `chore: bootstrap HookLens workspace and API`                 |
| 2     | Prisma schema, pgvector extension and migration for events, deliveries and attempts   | `feat(api): add webhook delivery data model`                  |
| 3     | Fastify intake, delivery list/detail endpoints and seed data                          | `feat(api): add webhook intake and delivery queries`          |
| 4     | Operator retry guard, idempotency, limits and audit log                               | `feat(api): add safe webhook retry workflow`                  |
| 5     | Markdown documents, parser, heading chunking and embeddings                           | `feat(rag): ingest knowledge documents into pgvector`         |
| 6     | Hybrid search, source-backed diagnosis and retrieval evaluation                       | `feat(rag): diagnose delivery failures with hybrid retrieval` |
| 7     | MCP Streamable HTTP server, resources and redacted read-only tools                    | `feat(mcp): add read-only HookLens MCP server`                |
| 8     | MCP knowledge/diagnosis tools, prompts and guarded retry confirmation                 | `feat(mcp): expose HookLens diagnosis workflows over MCP`     |
| 9     | Next.js deliveries, detail, diagnosis, knowledge and MCP views                        | `feat(web): add HookLens admin console`                       |
| 10    | Unit tests, Cypress scenario, README screenshots and CI expansion                     | `test: add portfolio-quality verification`                    |

## Rule for every stage

Before committing, update the `Development log` section in `README.md` with
what changed, what was verified and the next small deliverable.
