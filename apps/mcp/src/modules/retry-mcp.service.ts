import { McpToolError } from "./mcp-tool-error.js";

const DEFAULT_API_URL = "http://127.0.0.1:4000";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

type RetryResponse =
  | {
      kind: "queued";
      deliveryId: string;
      status: "pending";
      attemptNumber: number;
      retryCount: number;
      auditId: string;
      idempotentReplay: boolean;
    }
  | {
      kind: "rejected";
      code: string;
      message: string;
      auditId?: string;
      idempotentReplay: boolean;
    };

function retryUrl(deliveryId: string) {
  let baseUrl: URL;

  try {
    baseUrl = new URL(process.env.MCP_API_URL ?? DEFAULT_API_URL);
  } catch {
    throw new McpToolError(
      "MCP_API_URL_INVALID",
      "MCP_API_URL must point to a local HTTP HookLens API root.",
    );
  }

  if (
    baseUrl.protocol !== "http:" ||
    !LOCAL_API_HOSTS.has(baseUrl.hostname) ||
    baseUrl.pathname !== "/"
  ) {
    throw new McpToolError(
      "MCP_API_URL_INVALID",
      "MCP_API_URL must point to a local HTTP HookLens API root.",
    );
  }

  return new URL(`/api/v1/deliveries/${deliveryId}/retry`, baseUrl);
}

function operatorEnabled() {
  return process.env.MCP_OPERATOR_ENABLED?.toLowerCase() === "true";
}

function readRetryResponse(body: unknown, status: number): RetryResponse {
  const payload =
    body && typeof body === "object"
      ? (body as {
          data?: {
            deliveryId?: string;
            status?: string;
            attemptNumber?: number;
            retryCount?: number;
            auditId?: string;
          };
          error?: { code?: string; message?: string; auditId?: string };
          meta?: { idempotentReplay?: boolean };
        })
      : {};
  const idempotentReplay = payload.meta?.idempotentReplay === true;

  if (
    status >= 200 &&
    status < 300 &&
    payload.data?.deliveryId &&
    payload.data.status === "pending" &&
    typeof payload.data.attemptNumber === "number" &&
    typeof payload.data.retryCount === "number" &&
    payload.data.auditId
  ) {
    return {
      kind: "queued",
      deliveryId: payload.data.deliveryId,
      status: "pending",
      attemptNumber: payload.data.attemptNumber,
      retryCount: payload.data.retryCount,
      auditId: payload.data.auditId,
      idempotentReplay,
    };
  }

  return {
    kind: "rejected",
    code: payload.error?.code ?? "RETRY_REQUEST_FAILED",
    message:
      payload.error?.message ?? "HookLens API rejected the retry request.",
    auditId: payload.error?.auditId,
    idempotentReplay,
  };
}

export async function requestMcpRetry(input: {
  deliveryId: string;
  confirmed: boolean;
  idempotencyKey: string;
}) {
  if (!input.confirmed) {
    return {
      kind: "rejected",
      code: "CONFIRMATION_REQUIRED",
      message:
        "Retry requires confirmed: true after the user has explicitly approved it.",
      idempotentReplay: false,
    } satisfies RetryResponse;
  }

  let response: Response;

  try {
    response = await fetch(retryUrl(input.deliveryId), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hooklens-role": operatorEnabled() ? "operator" : "viewer",
      },
      body: JSON.stringify({
        confirmed: input.confirmed,
        idempotencyKey: input.idempotencyKey,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new McpToolError(
      "HOOKLENS_API_UNAVAILABLE",
      "The local HookLens API is unavailable. Start it before requesting a retry.",
    );
  }

  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    // The API result stays a sanitized, structured MCP error below.
  }

  return readRetryResponse(body, response.status);
}
