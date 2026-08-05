import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod";
import { diagnoseDeliveryFailure } from "./modules/delivery-diagnosis.service.js";
import { hooklensRepository } from "./modules/hooklens.repository.js";
import {
  knowledgeCategories,
  searchKnowledge,
} from "./modules/knowledge-search.service.js";
import { McpToolError } from "./modules/mcp-tool-error.js";
import { requestMcpRetry } from "./modules/retry-mcp.service.js";

const uuidSchema = z.string().uuid();
const eventTypeSchema = z
  .string()
  .trim()
  .min(3)
  .max(100)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);
const documentIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function jsonText(data: unknown) {
  return JSON.stringify(data, null, 2);
}

function toolSuccess(data: unknown) {
  return {
    content: [{ type: "text" as const, text: jsonText(data) }],
  };
}

function toolError(code: string, message: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: jsonText({ error: { code, message } }),
      },
    ],
  };
}

function resourceJson(uri: URL, data: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: jsonText(data),
      },
    ],
  };
}

function resourceError(uri: URL, message: string) {
  return resourceJson(uri, {
    error: {
      code: "NOT_FOUND",
      message,
    },
  });
}

async function runTool<T>(operation: () => Promise<T | null>) {
  try {
    const result = await operation();

    return result
      ? toolSuccess(result)
      : toolError("NOT_FOUND", "The requested HookLens record was not found.");
  } catch (error) {
    if (error instanceof McpToolError) {
      return toolError(error.code, error.message);
    }

    return toolError(
      "SERVICE_UNAVAILABLE",
      "HookLens data is temporarily unavailable.",
    );
  }
}

async function runRetryTool(
  operation: () => ReturnType<typeof requestMcpRetry>,
) {
  try {
    const result = await operation();

    return result.kind === "queued"
      ? toolSuccess(result)
      : {
          isError: true,
          content: [{ type: "text" as const, text: jsonText(result) }],
        };
  } catch (error) {
    if (error instanceof McpToolError) {
      return toolError(error.code, error.message);
    }

    return toolError(
      "RETRY_UNAVAILABLE",
      "The retry request could not be completed.",
    );
  }
}

async function runResource<T>(uri: URL, operation: () => Promise<T | null>) {
  try {
    const result = await operation();

    return result
      ? resourceJson(uri, result)
      : resourceError(uri, "The requested HookLens record was not found.");
  } catch {
    return resourceJson(uri, {
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "HookLens data is temporarily unavailable.",
      },
    });
  }
}

function readUuidResourceVariable(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return null;
  }

  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function readDocumentResourceVariable(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return null;
  }

  const parsed = documentIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function createHookLensMcpServer() {
  const server = new McpServer(
    {
      name: "hooklens-mcp",
      version: "0.1.0",
    },
    {
      instructions:
        "HookLens exposes redacted webhook delivery data and operational knowledge. Diagnostic tools are read-only. retry_webhook_delivery is the only write operation and must never be called without explicit user approval.",
    },
  );

  server.registerResource(
    "delivery",
    new ResourceTemplate("hooklens://deliveries/{deliveryId}", {
      list: undefined,
    }),
    {
      title: "Webhook delivery",
      description: "A redacted delivery, source event and its attempts.",
      mimeType: "application/json",
    },
    async (uri, { deliveryId }) => {
      const id = readUuidResourceVariable(deliveryId);

      return id
        ? runResource(uri, () => hooklensRepository.getDelivery(id))
        : resourceError(uri, "deliveryId must be a UUID.");
    },
  );

  server.registerResource(
    "event",
    new ResourceTemplate("hooklens://events/{eventId}", { list: undefined }),
    {
      title: "Webhook event",
      description: "A redacted webhook event and its delivery summary.",
      mimeType: "application/json",
    },
    async (uri, { eventId }) => {
      const id = readUuidResourceVariable(eventId);

      return id
        ? runResource(uri, () => hooklensRepository.getEvent(id))
        : resourceError(uri, "eventId must be a UUID.");
    },
  );

  server.registerResource(
    "knowledge-document",
    new ResourceTemplate("hooklens://documents/{documentId}", {
      list: undefined,
    }),
    {
      title: "Knowledge document",
      description: "An ingested documentation, runbook or postmortem document.",
      mimeType: "application/json",
    },
    async (uri, { documentId }) => {
      const id = readDocumentResourceVariable(documentId);

      return id
        ? runResource(uri, () => hooklensRepository.getKnowledgeDocument(id))
        : resourceError(uri, "documentId must be a kebab-case identifier.");
    },
  );

  server.registerResource(
    "runbook",
    new ResourceTemplate("hooklens://runbooks/{runbookId}", {
      list: undefined,
    }),
    {
      title: "Operational runbook",
      description: "An ingested operational runbook.",
      mimeType: "application/json",
    },
    async (uri, { runbookId }) => {
      const id = readDocumentResourceVariable(runbookId);

      return id
        ? runResource(uri, () =>
            hooklensRepository.getKnowledgeDocument(id, true),
          )
        : resourceError(uri, "runbookId must be a kebab-case identifier.");
    },
  );

  server.registerTool(
    "get_delivery_details",
    {
      title: "Get delivery details",
      description:
        "Return a redacted webhook delivery, source event and delivery attempts. This tool is read-only.",
      inputSchema: z.object({ deliveryId: uuidSchema }),
      annotations: { readOnlyHint: true },
    },
    ({ deliveryId }) =>
      runTool(() => hooklensRepository.getDelivery(deliveryId)),
  );

  server.registerTool(
    "get_webhook_event",
    {
      title: "Get webhook event",
      description:
        "Return a redacted webhook event and a summary of its deliveries. This tool is read-only.",
      inputSchema: z.object({ eventId: uuidSchema }),
      annotations: { readOnlyHint: true },
    },
    ({ eventId }) => runTool(() => hooklensRepository.getEvent(eventId)),
  );

  server.registerTool(
    "get_delivery_attempts",
    {
      title: "Get delivery attempts",
      description:
        "Return the redacted attempt history for one delivery. This tool is read-only.",
      inputSchema: z.object({ deliveryId: uuidSchema }),
      annotations: { readOnlyHint: true },
    },
    ({ deliveryId }) =>
      runTool(() => hooklensRepository.getDeliveryAttempts(deliveryId)),
  );

  server.registerTool(
    "get_knowledge_document",
    {
      title: "Get knowledge document",
      description:
        "Return an ingested documentation, runbook or postmortem document with chunks. This tool is read-only.",
      inputSchema: z.object({ documentId: documentIdSchema }),
      annotations: { readOnlyHint: true },
    },
    ({ documentId }) =>
      runTool(() => hooklensRepository.getKnowledgeDocument(documentId)),
  );

  server.registerTool(
    "search_knowledge",
    {
      title: "Search HookLens knowledge",
      description:
        "Search ingested documentation, runbooks and postmortems using hybrid retrieval. This tool is read-only.",
      inputSchema: z.object({
        query: z.string().trim().min(3).max(500),
        eventType: eventTypeSchema.optional(),
        categories: z
          .array(z.enum(knowledgeCategories))
          .min(1)
          .max(3)
          .optional(),
        limit: z.number().int().min(1).max(5).default(5),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ query, eventType, categories, limit }) =>
      runTool(async () => ({
        query,
        eventType: eventType ?? null,
        results: (
          await searchKnowledge({
            query,
            eventType,
            categories,
            limit,
          })
        ).map((result) => ({
          ...result,
          content: result.content.slice(0, 1_500),
        })),
      })),
  );

  server.registerTool(
    "find_relevant_runbook",
    {
      title: "Find a relevant runbook",
      description:
        "Search only operational runbooks for a delivery failure or integration question. This tool is read-only.",
      inputSchema: z.object({
        query: z.string().trim().min(3).max(500),
        eventType: eventTypeSchema.optional(),
        limit: z.number().int().min(1).max(3).default(3),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ query, eventType, limit }) =>
      runTool(async () => ({
        query,
        eventType: eventType ?? null,
        results: (
          await searchKnowledge({
            query,
            eventType,
            categories: ["runbook"],
            limit,
          })
        ).map((result) => ({
          ...result,
          content: result.content.slice(0, 1_500),
        })),
      })),
  );

  server.registerTool(
    "diagnose_delivery_failure",
    {
      title: "Diagnose delivery failure",
      description:
        "Use a failed delivery and retrieved HookLens knowledge to produce a redacted, source-backed diagnosis. This tool is read-only and never retries a delivery.",
      inputSchema: z.object({
        deliveryId: uuidSchema,
        includePayload: z.boolean().default(false),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ deliveryId, includePayload }) =>
      runTool(() => diagnoseDeliveryFailure({ deliveryId, includePayload })),
  );

  server.registerTool(
    "retry_webhook_delivery",
    {
      title: "Retry webhook delivery",
      description:
        "Queue one failed delivery for retry only after the user explicitly confirms it. Requires a new UUID idempotency key. This operation writes an audit record and never sends the outbound request itself.",
      inputSchema: z.object({
        deliveryId: uuidSchema,
        confirmed: z.boolean(),
        idempotencyKey: uuidSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ deliveryId, confirmed, idempotencyKey }) =>
      runRetryTool(() =>
        requestMcpRetry({ deliveryId, confirmed, idempotencyKey }),
      ),
  );

  server.registerPrompt(
    "diagnose-webhook-failure",
    {
      title: "Diagnose webhook failure",
      description:
        "Guide the model through evidence-based diagnosis of one failed delivery.",
      argsSchema: z.object({ deliveryId: uuidSchema }),
    },
    ({ deliveryId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Diagnose the failed webhook delivery ${deliveryId}. First call get_delivery_details, then diagnose_delivery_failure. Explain the likely causes, list safe checks in order, and cite the returned document title and section. Do not call retry_webhook_delivery unless I later explicitly ask for a retry.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "prepare-integration-checklist",
    {
      title: "Prepare integration checklist",
      description:
        "Create a practical integration checklist from the relevant HookLens documentation.",
      argsSchema: z.object({ eventType: eventTypeSchema }),
    },
    ({ eventType }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Prepare an integration checklist for ${eventType}. Use search_knowledge with the event type and retrieve the most relevant documentation and runbooks. Return a concise setup and verification checklist with sources. Do not expose or request secrets.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "review-retry-storm",
    {
      title: "Review retry storm",
      description:
        "Analyze retry-storm symptoms using evidence and recommend mitigations without retrying anything.",
      argsSchema: z.object({ deliveryId: uuidSchema.optional() }),
    },
    ({ deliveryId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review a potential webhook retry storm${deliveryId ? ` for delivery ${deliveryId}` : ""}. Search for retry-storm runbooks and postmortems. ${deliveryId ? "Inspect the delivery and attempts first." : ""} Separate observed facts from hypotheses, recommend safe mitigations, and cite sources. Do not call retry_webhook_delivery.`,
          },
        },
      ],
    }),
  );

  return server;
}
