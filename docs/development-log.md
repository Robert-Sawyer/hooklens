# Development log

Each delivery is intentionally small enough for one focused branch and pull request. The current work is Stage 10; detailed remaining tasks are in the [roadmap](roadmap.md).

## Day 1 - Foundation

- Created the pnpm workspace, Docker Compose PostgreSQL + pgvector service and GitHub Actions quality workflow.
- Added the Fastify API with `GET /health`, environment defaults and initial architecture notes.
- Verified the workspace bootstrap and local database connection path.

## Day 2 - Data model

- Added Prisma schema and migrations for webhook events, deliveries and attempts.
- Mapped the Docker database to host port `5433` to avoid a local PostgreSQL collision on `5432`.
- Added root environment loading for Prisma commands and a reproducible migration workflow.

## Day 3 - Webhook intake and delivery queries

- Added Zod-validated webhook intake, paginated delivery listing and delivery-detail endpoints.
- Introduced a Prisma repository layer and idempotent seed data with realistic successful and failed scenarios.
- Documented API usage and deterministic local examples.

## Day 4 - Safe retry workflow

- Added delivery retry audits, an idempotency constraint, row locking and an operator-only retry endpoint.
- Added confirmation, delivery-state and maximum-retry checks; accepted requests create a `pending` attempt only.
- Kept real outbound webhook delivery out of the portfolio demo.

## Day 5 - Knowledge ingestion

- Added fictional event references, security guides, runbooks and postmortems under `knowledge/`.
- Added frontmatter parsing, heading-based chunking, metadata extraction, checksums and dry-run validation.
- Added OpenAI embeddings, PostgreSQL storage and a 1536-dimension HNSW cosine index.

## Day 6 - Hybrid retrieval and diagnosis

- Added pgvector semantic search plus PostgreSQL full-text search, fused with reciprocal-rank fusion.
- Added source-backed failure diagnosis with redacted model context and no automatic retry.
- Added fixed retrieval evaluation with expected sources, a no-answer case and a minimum hit-rate threshold.

## Day 7 - MCP read-only foundation

- Added a separate MCP Streamable HTTP server restricted to loopback connections.
- Added redacted resources and read-only tools for deliveries, events, attempts and knowledge documents.
- Added input validation and independent MCP redaction at the client boundary.

## Day 8 - MCP diagnosis and guarded retry

- Added MCP hybrid knowledge search, runbook discovery, source-backed diagnosis and reusable prompts.
- Added the separately confirmed MCP retry tool, delegating to the API for authorization, idempotency and audit consistency.
- Documented Docker cleanup, HookLens-only database reset and local safety boundaries.

## Day 9 - Administrative console

- Added a separate Next.js workspace with Tailwind CSS and TanStack Query.
- Added deliveries, delivery details, diagnosis, safe retry, knowledge-base and MCP-capabilities views.
- Added API CORS configuration and browser-boundary redaction.
- Simplified client error handling and updated the direct PostCSS dependency.

## Day 10 - API unit tests

- Added Vitest and separate test TypeScript configuration without emitting tests into production builds.
- Added unit coverage for retry authorization and limits, data redaction, Markdown chunking and source-backed diagnosis with mocked model dependencies.
- Tightened `Authorization: Bearer` redaction to produce one consistent marker in API and MCP output.
- Added API tests to the pull-request quality workflow; verified 15 passing tests without Docker, PostgreSQL or an OpenAI API key.

## Day 11 - Web component tests

- Added a jsdom Vitest setup with React Testing Library, user interaction helpers and isolated React Query clients.
- Added tests for delivery loading, request errors and filter input; knowledge-document category selection; diagnosis sources; and explicit retry confirmation.
- Added the web suite to the root test command and pull-request quality workflow; the tests use mocked API calls and need no Docker, PostgreSQL or OpenAI key.

## Day 12 - Cypress end-to-end journey

- Added Cypress configuration and a browser-level journey from the seeded `401 Invalid signature` delivery to a source-backed diagnosis and confirmed retry.
- Kept the delivery list and retry workflow connected to the real local API and PostgreSQL database; intercepted only the OpenAI-dependent diagnosis response.
- Added explicit E2E setup, browser-install, headless and interactive commands, with an optional Cypress cache location outside the Windows system drive.

## Day 13 - CI, portfolio screenshots and demo guide

- Extended GitHub Actions with a PostgreSQL + pgvector service, a Cypress job and a seven-day `cypress-artifacts` artifact containing JUnit results and any failure screenshots.
- Configured the CI job to start the API and panel, wait for both local endpoints, then run Cypress against the seeded database.
- Added three screenshots from the live demo UI and a five-minute recruiter/reviewer presentation path to the root README.

## Documentation reorganization

- Replaced the long root README with a quick-start page and a direct shutdown/reset section.
- Split technical reference material into architecture, operations, API/MCP, project structure and technical-decision documents.
- Kept this chronological log separate so the README remains useful to a first-time visitor.
