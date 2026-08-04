CREATE TYPE "RetryAuditOutcome" AS ENUM ('queued', 'rejected');

CREATE TABLE "DeliveryRetryAudit" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT,
  "requestedDeliveryId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "outcome" "RetryAuditOutcome" NOT NULL,
  "reason" TEXT,
  "attemptNumber" INTEGER,
  "retryCountAfter" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeliveryRetryAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryRetryAudit_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES "WebhookDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeliveryRetryAudit_requestedDeliveryId_idempotencyKey_key"
  ON "DeliveryRetryAudit"("requestedDeliveryId", "idempotencyKey");
CREATE INDEX "DeliveryRetryAudit_deliveryId_createdAt_idx"
  ON "DeliveryRetryAudit"("deliveryId", "createdAt");
