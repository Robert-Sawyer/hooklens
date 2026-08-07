import type {
  DeliveryDetail,
  DeliveryDiagnosis,
  DeliveryListItem,
  DeliveryListResponse,
  KnowledgeDocument,
  KnowledgeDocumentDetail,
  RetryResult,
} from "../lib/api";

export const failedDelivery: DeliveryListItem = {
  id: "delivery-401",
  status: "failed",
  targetUrl: "https://receiver.example.test/hooks/payments",
  lastHttpStatus: 401,
  lastResponseBody: "Invalid signature",
  retryCount: 0,
  createdAt: "2026-08-07T10:00:00.000Z",
  event: {
    eventType: "payment.completed",
  },
  attempts: [
    {
      attemptNumber: 1,
      status: "failed",
      httpStatus: 401,
      responseBody: "Invalid signature",
      durationMs: 118,
    },
  ],
};

export const deliveriesResponse: DeliveryListResponse = {
  data: [failedDelivery],
  meta: {
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  },
};

export const failedDeliveryDetail: DeliveryDetail = {
  ...failedDelivery,
  updatedAt: "2026-08-07T10:01:00.000Z",
  requestHeaders: {
    authorization: "[REDACTED]",
    "content-type": "application/json",
  },
  event: {
    id: "event-payment-401",
    eventType: "payment.completed",
    payload: {
      paymentId: "pay_local_001",
      amount: 4999,
    },
    createdAt: "2026-08-07T10:00:00.000Z",
  },
  attempts: [
    {
      id: "attempt-1",
      attemptNumber: 1,
      status: "failed",
      httpStatus: 401,
      responseBody: "Invalid signature",
      durationMs: 118,
      createdAt: "2026-08-07T10:00:00.000Z",
    },
  ],
  retryAudits: [],
};

export const diagnosis: DeliveryDiagnosis = {
  kind: "diagnosed",
  deliveryId: failedDelivery.id,
  eventType: "payment.completed",
  status: "failed",
  httpStatus: 401,
  diagnosis:
    "The receiver rejected the webhook because the HMAC signature is invalid.",
  retrievalQuery: "payment.completed 401 Invalid signature",
  sources: [
    {
      documentId: "webhook-signatures",
      title: "Webhook Signature Guide",
      section: "Raw payload verification",
      category: "documentation",
    },
    {
      documentId: "invalid-signature-runbook",
      title: "Invalid Signature Runbook",
      section: "Check the active secret",
      category: "runbook",
    },
  ],
};

export const queuedRetry: RetryResult = {
  deliveryId: failedDelivery.id,
  status: "pending",
  attemptNumber: 2,
  retryCount: 1,
  auditId: "audit-queued-1",
};

export const knowledgeDocuments: KnowledgeDocument[] = [
  {
    id: "webhook-signatures",
    sourcePath: "knowledge/security/webhook-signatures.md",
    title: "Webhook Signature Guide",
    category: "documentation",
    eventTypes: ["payment.completed"],
    embeddingStatus: "ready",
    updatedAt: "2026-08-07T10:00:00.000Z",
    chunkCount: 2,
  },
  {
    id: "invalid-signature-runbook",
    sourcePath: "knowledge/runbooks/invalid-signature.md",
    title: "Invalid Signature Runbook",
    category: "runbook",
    eventTypes: ["payment.completed"],
    embeddingStatus: "ready",
    updatedAt: "2026-08-07T10:00:00.000Z",
    chunkCount: 1,
  },
];

export const knowledgeDocumentDetails: Record<string, KnowledgeDocumentDetail> =
  {
    "webhook-signatures": {
      ...knowledgeDocuments[0],
      chunks: [
        {
          id: "chunk-signature-1",
          sequence: 1,
          section: "Raw payload verification",
          content: "Verify the signature against the raw request body.",
          eventTypes: ["payment.completed"],
          tokenEstimate: 12,
          embeddingStatus: "ready",
        },
      ],
    },
    "invalid-signature-runbook": {
      ...knowledgeDocuments[1],
      chunks: [
        {
          id: "chunk-runbook-1",
          sequence: 1,
          section: "Check the active secret",
          content: "Confirm that the receiver uses the active signing secret.",
          eventTypes: ["payment.completed"],
          tokenEstimate: 12,
          embeddingStatus: "ready",
        },
      ],
    },
  };
