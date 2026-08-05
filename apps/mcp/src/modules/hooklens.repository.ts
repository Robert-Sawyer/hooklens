import { prisma } from "../db/prisma.js";
import { redactText, redactUrl, redactValue } from "./redaction.js";

const deliveryInclude = {
  event: true,
  attempts: {
    orderBy: {
      attemptNumber: "asc",
    },
  },
} as const;

function toSafeAttempt(attempt: {
  id: string;
  attemptNumber: number;
  status: string;
  httpStatus: number | null;
  responseBody: string | null;
  durationMs: number | null;
  createdAt: Date;
}) {
  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    httpStatus: attempt.httpStatus,
    responseBody: attempt.responseBody
      ? redactText(attempt.responseBody)
      : null,
    durationMs: attempt.durationMs,
    createdAt: attempt.createdAt,
  };
}

function toSafeDelivery(
  delivery: NonNullable<Awaited<ReturnType<typeof findDelivery>>>,
) {
  return {
    id: delivery.id,
    status: delivery.status,
    targetUrl: redactUrl(delivery.targetUrl),
    requestHeaders: redactValue(delivery.requestHeaders),
    lastHttpStatus: delivery.lastHttpStatus,
    lastResponseBody: delivery.lastResponseBody
      ? redactText(delivery.lastResponseBody)
      : null,
    retryCount: delivery.retryCount,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
    event: {
      id: delivery.event.id,
      eventType: delivery.event.eventType,
      payload: redactValue(delivery.event.payload),
      createdAt: delivery.event.createdAt,
    },
    attempts: delivery.attempts.map(toSafeAttempt),
  };
}

async function findDelivery(deliveryId: string) {
  return prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: deliveryInclude,
  });
}

export const hooklensRepository = {
  async getDelivery(deliveryId: string) {
    const delivery = await findDelivery(deliveryId);
    return delivery ? toSafeDelivery(delivery) : null;
  },

  async getDeliveryAttempts(deliveryId: string) {
    const delivery = await findDelivery(deliveryId);

    if (!delivery) {
      return null;
    }

    return {
      deliveryId: delivery.id,
      status: delivery.status,
      attempts: delivery.attempts.map(toSafeAttempt),
    };
  },

  async getEvent(eventId: string) {
    const event = await prisma.webhookEvent.findUnique({
      where: { id: eventId },
      include: {
        deliveries: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            status: true,
            lastHttpStatus: true,
            retryCount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!event) {
      return null;
    }

    return {
      id: event.id,
      eventType: event.eventType,
      payload: redactValue(event.payload),
      createdAt: event.createdAt,
      deliveries: event.deliveries,
    };
  },

  async getKnowledgeDocument(documentId: string, runbookOnly = false) {
    const document = await prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        ...(runbookOnly ? { category: "runbook" } : {}),
      },
      include: {
        chunks: {
          orderBy: {
            sequence: "asc",
          },
          select: {
            sequence: true,
            section: true,
            content: true,
            eventTypes: true,
            tokenEstimate: true,
            embeddingStatus: true,
          },
        },
      },
    });

    if (!document) {
      return null;
    }

    return {
      id: document.id,
      sourcePath: document.sourcePath,
      title: document.title,
      category: document.category,
      eventTypes: document.eventTypes,
      embeddingStatus: document.embeddingStatus,
      updatedAt: document.updatedAt,
      chunks: document.chunks,
    };
  },
};
