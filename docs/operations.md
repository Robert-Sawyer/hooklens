# Operations and local development

This document is the detailed counterpart to the [quick start in the root README](../README.md#run-locally). Commands use Windows PowerShell and `pnpm.cmd`; replace it with `pnpm` on macOS or Linux.

## Command reference

### Applications

| Command              | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `pnpm.cmd dev`       | Start the Fastify API with watch mode on port 4000.                |
| `pnpm.cmd web:dev`   | Start the Next.js admin console on port 3000.                      |
| `pnpm.cmd web:start` | Start the built Next.js console.                                   |
| `pnpm.cmd mcp:dev`   | Start the MCP Streamable HTTP server with watch mode on port 4001. |
| `pnpm.cmd mcp:start` | Start the built MCP server.                                        |

### Database and demo data

| Command                | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `pnpm.cmd db:up`       | Start PostgreSQL with pgvector through Docker Compose.          |
| `pnpm.cmd db:down`     | Stop HookLens containers and network; keep the database volume. |
| `pnpm.cmd db:generate` | Generate Prisma Client from the committed schema.               |
| `pnpm.cmd db:migrate`  | Apply committed migrations to the local database.               |
| `pnpm.cmd db:seed`     | Create or refresh three deterministic demo deliveries.          |

### Knowledge and quality

| Command                                  | Purpose                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm.cmd knowledge:ingest -- --dry-run` | Parse and validate Markdown without calling OpenAI or writing embeddings.                                                |
| `pnpm.cmd knowledge:ingest`              | Generate embeddings and store knowledge chunks. Requires `OPENAI_API_KEY`.                                               |
| `pnpm.cmd eval:retrieval`                | Evaluate fixed retrieval questions, expected sources and no-answer behavior. Requires ingested knowledge and an API key. |
| `pnpm.cmd test:api`                      | Type-check and run API unit tests. No Docker or OpenAI key required.                                                     |
| `pnpm.cmd test`                          | Run the currently available workspace test suite.                                                                        |
| `pnpm.cmd check`                         | Check Prettier and TypeScript in every workspace application.                                                            |
| `pnpm.cmd build`                         | Build API, MCP and Next.js applications.                                                                                 |
| `pnpm.cmd format`                        | Apply Prettier formatting.                                                                                               |

## Environment variables

Copy `.env.example` to `.env` before running Prisma or an application. The template contains safe local values. Do not commit the resulting `.env` file.

| Variable                 | Default / example                    | Used by               | Notes                                                                                                                      |
| ------------------------ | ------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | local PostgreSQL at `localhost:5433` | API, MCP, Prisma      | Must match the Docker Compose credentials.                                                                                 |
| `API_PORT`               | `4000`                               | API                   | Loopback Fastify port.                                                                                                     |
| `WEB_ORIGIN`             | `http://localhost:3000`              | API                   | The template value; comma-separate origins when needed. Without the variable, the API also accepts local `127.0.0.1:3000`. |
| `NEXT_PUBLIC_API_URL`    | `http://127.0.0.1:4000`              | Web                   | Public browser value; never place a secret here.                                                                           |
| `MCP_PORT`               | `4001`                               | MCP                   | Loopback MCP server port.                                                                                                  |
| `MCP_API_URL`            | `http://127.0.0.1:4000`              | MCP retry adapter     | Must point to a local API root.                                                                                            |
| `MCP_OPERATOR_ENABLED`   | `false`                              | MCP retry adapter     | Set to `true` only for an explicitly approved local retry demo.                                                            |
| `OPENAI_API_KEY`         | empty                                | API and MCP RAG       | Required for embedding, search and diagnosis. Keep it private.                                                             |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small`             | API and MCP RAG       | Must produce vectors compatible with the 1536-dimension schema.                                                            |
| `OPENAI_DIAGNOSIS_MODEL` | `gpt-5.6-terra`                      | API and MCP diagnosis | Can be overridden for a compatible model available to the project.                                                         |

## Normal local workflow

### Resume work on an existing database

```powershell
pnpm.cmd db:up
pnpm.cmd dev
```

Start `pnpm.cmd web:dev` and optionally `pnpm.cmd mcp:dev` in separate terminals. Migrations and seeding are needed only after a fresh database, a new migration, or when you want to reset the deterministic examples.

### Set up the complete RAG flow

1. Start the database and apply migrations.
2. Put `OPENAI_API_KEY` into `.env`.
3. Run `pnpm.cmd knowledge:ingest -- --dry-run` to inspect the source corpus.
4. Run `pnpm.cmd knowledge:ingest` to create or update embeddings.
5. Run `pnpm.cmd eval:retrieval` to check the fixed evaluation fixture.

Ingestion skips a document when its checksum, embedding model and chunk count are unchanged. Re-running it after editing Markdown updates only changed input.

## Shutdown, cleanup and database reset

### Daily shutdown

Use `Ctrl+C` in every application terminal, then:

```powershell
pnpm.cmd db:down
docker system df -v
```

`db:down` leaves the named PostgreSQL volume intact, so it normally releases little space. It is the recommended end-of-day command.

### Reclaim unused Docker space

Run these only after inspecting `docker system df -v`:

```powershell
docker builder prune -f
docker image prune -f
```

They can remove unused Docker cache or images from other local projects too. Avoid `docker system prune -a --volumes` as a routine cleanup because it removes unused resources globally, including other projects' volumes.

### Reset only HookLens PostgreSQL data

```powershell
docker compose down --volumes
pnpm.cmd db:up
pnpm.cmd db:migrate
pnpm.cmd db:seed
```

The first command is destructive for HookLens: it removes all local webhook, retry-audit and knowledge data. Run `pnpm.cmd knowledge:ingest` afterwards when you need the RAG corpus again.

## Troubleshooting

### `P1001: Can't reach database server`

Ensure Docker Desktop is running, then run `pnpm.cmd db:up`. Confirm that port `5433` is not occupied by another program and that the `.env` connection string uses `localhost:5433`.

### `P1000: Authentication failed`

The `DATABASE_URL` credentials must match `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` in `docker-compose.yml`. If the database volume was created with obsolete local credentials and its data is disposable, use the HookLens-only reset above, then migrate and seed again.

### `pnpm.ps1 cannot be loaded because running scripts is disabled`

Use `pnpm.cmd` in PowerShell. It runs the same package-manager command without depending on the PowerShell script shim.

### `EPERM` while TypeScript writes `apps/api/dist` or `apps/mcp/dist`

This can occur when another Windows account created the generated build folder. Open an elevated PowerShell in the repository root and repair permissions only for the generated directories:

```powershell
$buildDirectories = @(
  (Resolve-Path -LiteralPath ".\apps\api\dist").Path,
  (Resolve-Path -LiteralPath ".\apps\mcp\dist").Path
)

$grant = "$($env:USERDOMAIN)\$($env:USERNAME):(OI)(CI)F"

foreach ($directory in $buildDirectories) {
  & takeown.exe /F $directory /R /D Y
  & icacls.exe $directory /grant $grant /T /C
}
```

Then run `pnpm.cmd build` again. This does not change source files or the database.

### `EPERM` while Prisma generates its client

Stop API, MCP, Next.js and IDE processes that may hold Node files open. Then run `pnpm.cmd install` and `pnpm.cmd db:generate` from an interactive PowerShell. Do not commit anything inside `node_modules`.

## Related documents

- [Architecture](architecture.md)
- [API and MCP reference](api-and-mcp.md)
- [Technical decisions](technical-decisions.md)
