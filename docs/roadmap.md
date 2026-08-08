# Delivery roadmap

The functional HookLens portfolio application is complete through Stage 10. The final quality signals make the repository easier to evaluate during a technical recruitment process.

| Stage | Status   | Deliverable                                                                                  |
| ----- | -------- | -------------------------------------------------------------------------------------------- |
| 1     | Complete | Workspace, Fastify health endpoint, Docker PostgreSQL + pgvector, CI and base documentation. |
| 2     | Complete | Prisma schema and migrations for events, deliveries and attempts.                            |
| 3     | Complete | Webhook intake, delivery list/detail APIs and deterministic seed data.                       |
| 4     | Complete | Guarded retry, idempotency, audit log and retry limit.                                       |
| 5     | Complete | Markdown knowledge, heading chunking, embeddings and pgvector storage.                       |
| 6     | Complete | Hybrid retrieval, source-backed diagnosis and retrieval evaluation.                          |
| 7     | Complete | Read-only MCP server with resources and tools.                                               |
| 8     | Complete | MCP search, diagnosis, prompts and confirmed retry adapter.                                  |
| 9     | Complete | Next.js delivery, diagnosis, knowledge and MCP administration views.                         |
| 10    | Complete | Unit coverage, web tests, Cypress journey, screenshots and final CI expansion.               |

## Stage 10 remaining deliveries

1. **API unit tests — complete.** Vitest covers retry guards, redaction, source-backed diagnosis and Markdown chunking; the API suite runs in pull-request CI.
2. **Web component tests â€” complete.** Vitest and React Testing Library cover delivery loading and error states, filter requests, knowledge-category selection, diagnosis sources and retry confirmation; the suite runs in pull-request CI.
3. **End-to-end scenario â€” complete.** Cypress exercises the seeded failed delivery, source-backed diagnosis response and confirmed retry against the real local API and PostgreSQL database; only the OpenAI-dependent diagnosis response is intercepted.
4. **Portfolio finish — complete.** The README contains a concise five-minute
   presentation flow and screenshots from the running UI. GitHub Actions runs
   Cypress against PostgreSQL and uploads JUnit reports plus failure screenshots
   as a pull-request artifact.

## Rule for future deliveries

Keep a branch focused on one deliverable. Before opening a pull request:

1. update the relevant document and [development log](development-log.md);
2. run the smallest relevant verification command locally;
3. run `pnpm.cmd check`, `pnpm.cmd test` and `pnpm.cmd build` when the local environment is available;
4. describe any deliberate scope limit, especially one related to safety or external operations.
