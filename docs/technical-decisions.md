# Technical decisions

This document explains the choices behind HookLens in the form useful during a technical interview or repository review. The goal was a credible, focused portfolio system rather than a feature-complete webhook platform.

| Decision                                           | Why it fits HookLens                                                                                                                         | Main trade-off                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| pnpm workspace with separate API, web and MCP apps | Makes trust boundaries and independently runnable processes visible without the overhead of several repositories.                            | Shared code is intentionally limited; some read-side logic is duplicated between API and MCP.      |
| Fastify, TypeScript and Zod                        | Small, explicit REST layer with runtime validation at every input boundary.                                                                  | Less convention and automation than a larger framework.                                            |
| Prisma with PostgreSQL                             | A single relational store keeps delivery state, audit records and knowledge metadata consistent.                                             | Vector queries use raw Prisma SQL where the ORM has no first-class pgvector type.                  |
| PostgreSQL + pgvector HNSW                         | Keeps operational and semantic knowledge in one database. The HNSW cosine index gives fast retrieval for the small-to-medium corpus.         | HNSW requires more memory and slower index construction than IVFFlat.                              |
| Heading-based Markdown chunks                      | Documentation remains reviewable in Git while section names produce useful, human-readable citations.                                        | Simple chunking can need refinement for unusually long or poorly structured documents.             |
| Hybrid retrieval with reciprocal-rank fusion       | Full-text search catches exact terms such as `401` or `HMAC`; embeddings catch related wording. RRF combines both without score calibration. | Two queries and embedding generation add latency and provider cost.                                |
| Deterministic sources from retrieval results       | The model may explain evidence, but it cannot invent citations because source objects are built from the retrieved chunks.                   | A fluent answer is still limited by retrieval quality and corpus coverage.                         |
| OpenAI only behind server processes                | API keys stay in ignored environment files; the browser never receives them.                                                                 | Local RAG diagnosis depends on an external API key and provider availability.                      |
| MCP Streamable HTTP on loopback                    | Lets compatible AI clients discover tools, resources and prompts through one standard local endpoint.                                        | It is a portfolio/local integration, not a production multi-user MCP deployment.                   |
| Retry delegates to API                             | The MCP write tool does not duplicate role checks, locking, idempotency, retry limits or audit logging.                                      | MCP requires a running API process for the one write operation.                                    |
| Retry queues rather than delivers outbound HTTP    | Demonstrates safe operator workflow without risking a real third-party endpoint during a demo.                                               | A production sender worker, backoff policy and endpoint allow-list are intentionally out of scope. |
| Redaction before browser and model boundaries      | Hides authorization headers, secret-shaped JSON fields, bearer tokens, response secrets and URL queries before they leave the trusted store. | Pattern-based masking needs maintenance as integrations add new secret formats.                    |

## RAG quality controls

The repository includes a fixed retrieval fixture with expected document IDs and one deliberately unanswerable question. `pnpm.cmd eval:retrieval` measures top-3 source hit rate, no-answer behavior and average latency. It returns a non-zero exit code if the hit rate drops below 80% or the no-answer case fails.

This is deliberately smaller than a full evaluation platform, but it gives a repeatable regression signal after changing chunking, metadata, models or retrieval logic.

## Security posture and deliberate limits

The project demonstrates a safety-first local workflow, not production identity management. `viewer` and `operator` are development roles inferred from a local header; a real deployment would replace them with authenticated identity, authorization policy, rate limiting, monitoring and secret management.

The database still stores payloads and headers for operational diagnosis, so the redaction boundary is essential but not a substitute for production encryption, retention policies and access controls. Never use a copied portfolio setup with real production webhook secrets.

## How to summarize it to a technical recruiter

HookLens centralizes two sources of truth that are often separated: the actual webhook-delivery history and the integration team's operational knowledge. A developer can inspect a failed attempt, retrieve the most relevant runbook and receive a source-backed diagnosis. The same capabilities are available through a web UI and MCP, while retries remain isolated, confirmed, idempotent and audited.

## Related documents

- [Architecture](architecture.md)
- [API and MCP reference](api-and-mcp.md)
- [Development log](development-log.md)
