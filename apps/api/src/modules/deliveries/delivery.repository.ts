import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type {
  DeliveryListQuery,
  IntakeWebhookInput,
} from "./delivery.schemas.js";

const deliveryListInclude = {
  event: {
    select: {
      eventType: true,
    },
  },
  attempts: {
    orderBy: {
      attemptNumber: "desc",
    },
    take: 1,
  },
} satisfies Prisma.WebhookDeliveryInclude;

const deliveryDetailInclude = {
  event: true,
  attempts: {
    orderBy: {
      attemptNumber: "asc",
    },
  },
} satisfies Prisma.WebhookDeliveryInclude;

function asJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

export const deliveryRepository = {
  async createFromIntake(input: IntakeWebhookInput) {
    return prisma.$transaction(async (transaction) => {
      const event = await transaction.webhookEvent.create({
        data: {
          eventType: input.eventType,
          payload: asJsonObject(input.payload),
        },
      });

      return transaction.webhookDelivery.create({
        data: {
          eventId: event.id,
          targetUrl: input.targetUrl,
          status: input.attempt.status,
          requestHeaders: asJsonObject(input.requestHeaders),
          lastHttpStatus: input.attempt.httpStatus,
          lastResponseBody: input.attempt.responseBody,
          retryCount: 0,
          attempts: {
            create: {
              attemptNumber: 1,
              status: input.attempt.status,
              httpStatus: input.attempt.httpStatus,
              responseBody: input.attempt.responseBody,
              durationMs: input.attempt.durationMs,
            },
          },
        },
        include: deliveryDetailInclude,
      });
    });
  },

  async list(query: DeliveryListQuery) {
    const where: Prisma.WebhookDeliveryWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.eventType ? { event: { eventType: query.eventType } } : {}),
    };

    const [total, deliveries] = await prisma.$transaction([
      prisma.webhookDelivery.count({ where }),
      prisma.webhookDelivery.findMany({
        where,
        include: deliveryListInclude,
        orderBy: {
          createdAt: "desc",
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { total, deliveries };
  },

  async findById(deliveryId: string) {
    return prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: deliveryDetailInclude,
    });
  },
};
