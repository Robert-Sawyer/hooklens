CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'delivered', 'failed');

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
  "requestHeaders" JSONB NOT NULL DEFAULT '{}',
  "lastHttpStatus" INTEGER,
  "lastResponseBody" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebhookDelivery_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DeliveryAttempt" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "DeliveryStatus" NOT NULL,
  "httpStatus" INTEGER,
  "responseBody" TEXT,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryAttempt_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES "WebhookDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WebhookEvent_eventType_createdAt_idx"
  ON "WebhookEvent"("eventType", "createdAt");
CREATE INDEX "WebhookDelivery_eventId_idx"
  ON "WebhookDelivery"("eventId");
CREATE INDEX "WebhookDelivery_status_createdAt_idx"
  ON "WebhookDelivery"("status", "createdAt");
CREATE INDEX "DeliveryAttempt_deliveryId_createdAt_idx"
  ON "DeliveryAttempt"("deliveryId", "createdAt");
CREATE UNIQUE INDEX "DeliveryAttempt_deliveryId_attemptNumber_key"
  ON "DeliveryAttempt"("deliveryId", "attemptNumber");
