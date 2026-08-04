import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

type SeedAttempt = {
  id: string;
  attemptNumber: number;
  status: "pending" | "delivered" | "failed";
  httpStatus?: number;
  responseBody?: string;
  durationMs?: number;
};

type SeedDelivery = {
  id: string;
  eventId: string;
  targetUrl: string;
  status: "pending" | "delivered" | "failed";
  requestHeaders: Prisma.InputJsonObject;
  lastHttpStatus?: number;
  lastResponseBody?: string;
  retryCount: number;
  attempts: SeedAttempt[];
};

const events = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    eventType: "payment.completed",
    payload: {
      paymentId: "pay_demo_001",
      amount: 4999,
      currency: "PLN",
      customerId: "cus_demo_001",
    },
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    eventType: "subscription.cancelled",
    payload: {
      subscriptionId: "sub_demo_002",
      customerId: "cus_demo_002",
      cancelAtPeriodEnd: false,
    },
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    eventType: "user.created",
    payload: {
      userId: "usr_demo_003",
      email: "ada@example.test",
    },
  },
] satisfies Array<{
  id: string;
  eventType: string;
  payload: Prisma.InputJsonObject;
}>;

const deliveries: SeedDelivery[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    eventId: events[0].id,
    targetUrl: "https://receiver.example.test/hooks/payments",
    status: "failed",
    requestHeaders: {
      "content-type": "application/json",
      "x-hooklens-signature": "demo-signature-redacted",
    },
    lastHttpStatus: 401,
    lastResponseBody: "Invalid signature",
    retryCount: 2,
    attempts: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        attemptNumber: 1,
        status: "failed",
        httpStatus: 401,
        responseBody: "Invalid signature",
        durationMs: 118,
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        attemptNumber: 2,
        status: "failed",
        httpStatus: 401,
        responseBody: "Invalid signature",
        durationMs: 121,
      },
      {
        id: "30000000-0000-4000-8000-000000000003",
        attemptNumber: 3,
        status: "failed",
        httpStatus: 401,
        responseBody: "Invalid signature",
        durationMs: 123,
      },
    ],
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    eventId: events[1].id,
    targetUrl: "https://receiver.example.test/hooks/subscriptions",
    status: "failed",
    requestHeaders: {
      "content-type": "application/json",
    },
    lastHttpStatus: 504,
    lastResponseBody: "Gateway Timeout",
    retryCount: 3,
    attempts: [
      {
        id: "30000000-0000-4000-8000-000000000004",
        attemptNumber: 1,
        status: "failed",
        httpStatus: 504,
        responseBody: "Gateway Timeout",
        durationMs: 30_000,
      },
      {
        id: "30000000-0000-4000-8000-000000000006",
        attemptNumber: 2,
        status: "failed",
        httpStatus: 504,
        responseBody: "Gateway Timeout",
        durationMs: 30_000,
      },
      {
        id: "30000000-0000-4000-8000-000000000007",
        attemptNumber: 3,
        status: "failed",
        httpStatus: 504,
        responseBody: "Gateway Timeout",
        durationMs: 30_000,
      },
      {
        id: "30000000-0000-4000-8000-000000000008",
        attemptNumber: 4,
        status: "failed",
        httpStatus: 504,
        responseBody: "Gateway Timeout",
        durationMs: 30_000,
      },
    ],
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    eventId: events[2].id,
    targetUrl: "https://receiver.example.test/hooks/users",
    status: "delivered",
    requestHeaders: {
      "content-type": "application/json",
    },
    lastHttpStatus: 204,
    retryCount: 0,
    attempts: [
      {
        id: "30000000-0000-4000-8000-000000000005",
        attemptNumber: 1,
        status: "delivered",
        httpStatus: 204,
        durationMs: 87,
      },
    ],
  },
];

async function main() {
  for (const event of events) {
    await prisma.webhookEvent.upsert({
      where: { id: event.id },
      create: event,
      update: {
        eventType: event.eventType,
        payload: event.payload,
      },
    });
  }

  const seededDeliveryIds = deliveries.map((delivery) => delivery.id);

  await prisma.deliveryRetryAudit.deleteMany({
    where: {
      requestedDeliveryId: {
        in: seededDeliveryIds,
      },
    },
  });

  await prisma.deliveryAttempt.deleteMany({
    where: {
      deliveryId: {
        in: seededDeliveryIds,
      },
    },
  });

  for (const delivery of deliveries) {
    await prisma.webhookDelivery.upsert({
      where: { id: delivery.id },
      create: {
        id: delivery.id,
        eventId: delivery.eventId,
        targetUrl: delivery.targetUrl,
        status: delivery.status,
        requestHeaders: delivery.requestHeaders,
        lastHttpStatus: delivery.lastHttpStatus,
        lastResponseBody: delivery.lastResponseBody,
        retryCount: delivery.retryCount,
      },
      update: {
        eventId: delivery.eventId,
        targetUrl: delivery.targetUrl,
        status: delivery.status,
        requestHeaders: delivery.requestHeaders,
        lastHttpStatus: delivery.lastHttpStatus,
        lastResponseBody: delivery.lastResponseBody,
        retryCount: delivery.retryCount,
      },
    });

    for (const attempt of delivery.attempts) {
      await prisma.deliveryAttempt.create({
        data: {
          id: attempt.id,
          deliveryId: delivery.id,
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          httpStatus: attempt.httpStatus,
          responseBody: attempt.responseBody,
          durationMs: attempt.durationMs,
        },
      });
    }
  }

  console.log(
    `Seeded ${events.length} events and ${deliveries.length} deliveries.`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
