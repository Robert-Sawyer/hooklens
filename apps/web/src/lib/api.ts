export type DeliveryStatus = "pending" | "delivered" | "failed";
export type KnowledgeCategory = "documentation" | "runbook" | "postmortem";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    auditId?: string;
  };
};

type ApiResponse<T> = { data: T };

export type DeliveryListItem = {
  id: string;
  status: DeliveryStatus;
  targetUrl: string;
  lastHttpStatus: number | null;
  lastResponseBody: string | null;
  retryCount: number;
  createdAt: string;
  event: { eventType: string };
  attempts: Array<{
    attemptNumber: number;
    status: DeliveryStatus;
    httpStatus: number | null;
    responseBody: string | null;
    durationMs: number | null;
  }>;
};

export type DeliveryListResponse = ApiResponse<DeliveryListItem[]> & {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type DeliveryDetail = Omit<DeliveryListItem, "event" | "attempts"> & {
  updatedAt: string;
  requestHeaders: Record<string, unknown>;
  event: {
    id: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  };
  attempts: Array<{
    id: string;
    attemptNumber: number;
    status: DeliveryStatus;
    httpStatus: number | null;
    responseBody: string | null;
    durationMs: number | null;
    createdAt: string;
  }>;
  retryAudits: Array<{
    id: string;
    actorRole: "viewer" | "operator";
    outcome: "queued" | "rejected";
    reason: string | null;
    attemptNumber: number | null;
    retryCountAfter: number | null;
    createdAt: string;
  }>;
};

export type DeliveryDiagnosis = {
  kind: "diagnosed";
  deliveryId: string;
  eventType: string;
  status: DeliveryStatus;
  httpStatus: number | null;
  diagnosis: string;
  retrievalQuery: string;
  sources: Array<{
    documentId: string;
    title: string;
    section: string;
    category: KnowledgeCategory;
  }>;
};

export type KnowledgeDocument = {
  id: string;
  sourcePath: string;
  title: string;
  category: KnowledgeCategory;
  eventTypes: string[];
  embeddingStatus: "pending" | "ready" | "failed";
  updatedAt: string;
  chunkCount: number;
};

export type KnowledgeDocumentDetail = KnowledgeDocument & {
  chunks: Array<{
    id: string;
    sequence: number;
    section: string;
    content: string;
    eventTypes: string[];
    tokenEstimate: number;
    embeddingStatus: "pending" | "ready" | "failed";
  }>;
};

export type RetryResult = {
  deliveryId: string;
  status: "pending";
  attemptNumber: number;
  retryCount: number;
  auditId: string;
};

export class HookLensApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly auditId?: string,
  ) {
    super(message);
    this.name = "HookLensApiError";
  }
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!response.ok) {
    throw new HookLensApiError(
      body.error?.message ?? "HookLens API request failed.",
      response.status,
      body.error?.code,
      body.error?.auditId,
    );
  }

  return body as T;
}

export function getDeliveries(input: {
  page: number;
  status?: DeliveryStatus;
  eventType?: string;
}) {
  const search = new URLSearchParams({
    page: String(input.page),
    pageSize: "10",
  });

  if (input.status) {
    search.set("status", input.status);
  }

  const eventType = input.eventType?.trim();

  if (eventType) {
    search.set("eventType", eventType);
  }

  return request<DeliveryListResponse>(`/api/v1/deliveries?${search}`);
}

export function getDelivery(deliveryId: string) {
  return request<ApiResponse<DeliveryDetail>>(
    `/api/v1/deliveries/${deliveryId}`,
  );
}

export function getDeliveryDiagnosis(deliveryId: string) {
  return request<ApiResponse<DeliveryDiagnosis>>(
    `/api/v1/deliveries/${deliveryId}/diagnosis`,
    { method: "POST" },
  );
}

export function requestRetry(deliveryId: string, idempotencyKey: string) {
  return request<ApiResponse<RetryResult>>(
    `/api/v1/deliveries/${deliveryId}/retry`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hooklens-role": "operator",
      },
      body: JSON.stringify({ confirmed: true, idempotencyKey }),
    },
  );
}

export function getKnowledgeDocuments(category?: KnowledgeCategory) {
  const search = category ? `?category=${category}` : "";
  return request<ApiResponse<KnowledgeDocument[]>>(
    `/api/v1/knowledge/documents${search}`,
  );
}

export function getKnowledgeDocument(documentId: string) {
  return request<ApiResponse<KnowledgeDocumentDetail>>(
    `/api/v1/knowledge/documents/${documentId}`,
  );
}
