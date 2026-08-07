# API and MCP reference

## REST API

Start the API with `pnpm.cmd dev`. It listens on `http://127.0.0.1:4000` by default. Browser-facing responses redact credential-shaped headers and payload fields, receiver-response secrets and target URL query strings.

| Method | Path                                       | Purpose                                                                      |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `GET`  | `/health`                                  | API health check.                                                            |
| `POST` | `/api/v1/webhooks`                         | Store an event, delivery and first delivery attempt.                         |
| `GET`  | `/api/v1/deliveries`                       | Paginated delivery list; optional `page`, `pageSize`, `status`, `eventType`. |
| `GET`  | `/api/v1/deliveries/:deliveryId`           | Redacted delivery, source event, attempts and retry audits.                  |
| `POST` | `/api/v1/deliveries/:deliveryId/retry`     | Request a guarded local retry.                                               |
| `POST` | `/api/v1/deliveries/:deliveryId/diagnosis` | Produce a source-backed diagnosis for a failed delivery.                     |
| `GET`  | `/api/v1/knowledge/documents`              | List ingested documents; optional `category`.                                |
| `GET`  | `/api/v1/knowledge/documents/:documentId`  | Return an ingested document and ordered chunks.                              |

### Webhook intake shape

`POST /api/v1/webhooks` accepts an event type, JSON payload, target URL, request headers and the observed first attempt. Zod validates event naming, URL, headers, status code and duration ranges before any database write.

```json
{
  "eventType": "payment.completed",
  "payload": { "paymentId": "pay_local_001", "amount": 4999 },
  "targetUrl": "https://receiver.example.test/hooks/payments",
  "requestHeaders": { "content-type": "application/json" },
  "attempt": {
    "status": "failed",
    "httpStatus": 401,
    "responseBody": "Invalid signature",
    "durationMs": 118
  }
}
```

### Guarded retry

The retry API requires a viewer or operator role through `x-hooklens-role`. Any missing or unsupported value is treated as `viewer`; only `operator` can queue a retry in this local demo.

```json
{
  "confirmed": true,
  "idempotencyKey": "a-new-uuid-for-this-request"
}
```

The operation is rejected unless all conditions hold:

- the delivery exists and its current state is `failed`;
- the caller is an `operator`;
- `confirmed` is `true`;
- fewer than three retries were already queued;
- the `(deliveryId, idempotencyKey)` pair has not already been handled.

An accepted request creates an audit record and a new `pending` attempt. It does not make an external HTTP delivery.

### Diagnosis

`POST /api/v1/deliveries/:deliveryId/diagnosis` accepts the optional query parameter `includePayload=true`. Diagnosis only runs for failed deliveries and requires `OPENAI_API_KEY`, ingested knowledge and a reachable model. A `503 DIAGNOSIS_UNAVAILABLE` normally points to missing AI configuration or provider availability. The response includes sources built from retrieved chunks.

## MCP server

Start the local MCP server with `pnpm.cmd mcp:dev`. The server exposes Streamable HTTP at `http://127.0.0.1:4001/mcp` and a health check at `http://127.0.0.1:4001/health`. It accepts local host and browser origin only.

### Resources

| URI template                         | Content                                                    |
| ------------------------------------ | ---------------------------------------------------------- |
| `hooklens://deliveries/{deliveryId}` | Redacted delivery, source event and attempts.              |
| `hooklens://events/{eventId}`        | Redacted event and delivery summary.                       |
| `hooklens://documents/{documentId}`  | Ingested documentation, runbook or postmortem with chunks. |
| `hooklens://runbooks/{runbookId}`    | Ingested runbook only.                                     |

### Tools

| Tool                        | Access    | Purpose                                                      |
| --------------------------- | --------- | ------------------------------------------------------------ |
| `get_delivery_details`      | Read-only | Return a redacted delivery and attempt history.              |
| `get_webhook_event`         | Read-only | Return a redacted event and linked-delivery summary.         |
| `get_delivery_attempts`     | Read-only | Return attempt history for one delivery.                     |
| `get_knowledge_document`    | Read-only | Return an ingested document and its chunks.                  |
| `search_knowledge`          | Read-only | Hybrid search with optional event type and category filters. |
| `find_relevant_runbook`     | Read-only | Hybrid search restricted to runbooks.                        |
| `diagnose_delivery_failure` | Read-only | Redacted, source-backed diagnosis of a failed delivery.      |
| `retry_webhook_delivery`    | Write     | Separately confirmed, auditable retry request.               |

The retry tool requires `confirmed: true`, a UUID idempotency key, `MCP_OPERATOR_ENABLED=true`, and a running local API configured through `MCP_API_URL`. It delegates to the API retry endpoint and returns a structured rejection if any safety rule fails.

### Prompts

| Prompt                          | Purpose                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `diagnose-webhook-failure`      | Gather delivery evidence, run diagnosis and cite returned sources without retrying. |
| `prepare-integration-checklist` | Build a concise event-type checklist from documentation and runbooks.               |
| `review-retry-storm`            | Investigate retry-storm symptoms and mitigations without triggering a retry.        |

## Web console routes

| Route                     | View                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `/deliveries`             | Filtered and paginated delivery list.                      |
| `/deliveries/:deliveryId` | Delivery details, attempts, diagnosis and confirmed retry. |
| `/knowledge`              | Ingested documents, chunk status and category filter.      |
| `/mcp`                    | MCP resources, tools and prompts inventory.                |

## Related documents

- [Architecture](architecture.md)
- [Operations and environment variables](operations.md)
- [Technical decisions](technical-decisions.md)
