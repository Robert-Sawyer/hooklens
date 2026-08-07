import { Prisma, type DeliveryRetryAudit } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { RetryDeliveryInput } from "./delivery.schemas.js";

export const MAX_RETRY_COUNT = 3;
export const retryRoleHeader = "x-hooklens-role";

export type RetryActorRole = "viewer" | "operator";

export type RetryRejectionReason =
  | "DELIVERY_NOT_FOUND"
  | "FORBIDDEN"
  | "CONFIRMATION_REQUIRED"
  | "DELIVERY_NOT_FAILED"
  | "RETRY_LIMIT_REACHED";

type RequestRetryInput = RetryDeliveryInput & {
  deliveryId: string;
  actorRole: RetryActorRole;
};

export type RetryRequestResult =
  | {
      kind: "queued";
      auditId: string;
      deliveryId: string;
      attemptNumber: number;
      retryCount: number;
      replayed: boolean;
    }
  | {
      kind: "rejected";
      auditId: string;
      deliveryId: string;
      reason: RetryRejectionReason;
      replayed: boolean;
    };

export const retryRejectionMessages: Record<RetryRejectionReason, string> = {
  DELIVERY_NOT_FOUND: "Delivery not found.",
  FORBIDDEN: "Only an operator can request a retry.",
  CONFIRMATION_REQUIRED: "Retry requires confirmed: true.",
  DELIVERY_NOT_FAILED: "Only failed deliveries can be retried.",
  RETRY_LIMIT_REACHED: `A delivery can be retried at most ${MAX_RETRY_COUNT} times.`,
};

type RetryEligibility = {
  status: string;
  retryCount: number;
} | null;

export function getRetryRejectionReason({
  delivery,
  actorRole,
  confirmed,
}: {
  delivery: RetryEligibility;
  actorRole: RetryActorRole;
  confirmed: boolean;
}): RetryRejectionReason | null {
  if (!delivery) {
    return "DELIVERY_NOT_FOUND";
  }

  if (actorRole !== "operator") {
    return "FORBIDDEN";
  }

  if (!confirmed) {
    return "CONFIRMATION_REQUIRED";
  }

  if (delivery.status !== "failed") {
    return "DELIVERY_NOT_FAILED";
  }

  return delivery.retryCount >= MAX_RETRY_COUNT ? "RETRY_LIMIT_REACHED" : null;
}

export function resolveRetryActorRole(
  roleHeader: string | string[] | undefined,
): RetryActorRole {
  const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;

  return role?.toLowerCase() === "operator" ? "operator" : "viewer";
}

export function retryRejectionStatus(reason: RetryRejectionReason) {
  switch (reason) {
    case "DELIVERY_NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "CONFIRMATION_REQUIRED":
      return 400;
    case "DELIVERY_NOT_FAILED":
    case "RETRY_LIMIT_REACHED":
      return 409;
  }
}

function toRetryResult(
  audit: DeliveryRetryAudit,
  replayed: boolean,
): RetryRequestResult {
  if (audit.outcome === "queued") {
    if (audit.attemptNumber === null || audit.retryCountAfter === null) {
      throw new Error("Queued retry audit is missing retry metadata.");
    }

    return {
      kind: "queued",
      auditId: audit.id,
      deliveryId: audit.requestedDeliveryId,
      attemptNumber: audit.attemptNumber,
      retryCount: audit.retryCountAfter,
      replayed,
    };
  }

  if (!audit.reason) {
    throw new Error("Rejected retry audit is missing a rejection reason.");
  }

  return {
    kind: "rejected",
    auditId: audit.id,
    deliveryId: audit.requestedDeliveryId,
    reason: audit.reason as RetryRejectionReason,
    replayed,
  };
}

async function findExistingRetry(
  input: RequestRetryInput,
): Promise<RetryRequestResult | null> {
  const audit = await prisma.deliveryRetryAudit.findUnique({
    where: {
      requestedDeliveryId_idempotencyKey: {
        requestedDeliveryId: input.deliveryId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });

  return audit ? toRetryResult(audit, true) : null;
}

export async function requestDeliveryRetry(
  input: RequestRetryInput,
): Promise<RetryRequestResult> {
  const existingRetry = await findExistingRetry(input);

  if (existingRetry) {
    return existingRetry;
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const auditSelector = {
        requestedDeliveryId_idempotencyKey: {
          requestedDeliveryId: input.deliveryId,
          idempotencyKey: input.idempotencyKey,
        },
      };

      const existingAudit = await transaction.deliveryRetryAudit.findUnique({
        where: auditSelector,
      });

      if (existingAudit) {
        return toRetryResult(existingAudit, true);
      }

      const lockedDelivery = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "WebhookDelivery" WHERE "id" = ${input.deliveryId} FOR UPDATE`,
      );

      const auditCreatedWhileWaiting =
        await transaction.deliveryRetryAudit.findUnique({
          where: auditSelector,
        });

      if (auditCreatedWhileWaiting) {
        return toRetryResult(auditCreatedWhileWaiting, true);
      }

      const delivery =
        lockedDelivery.length === 0
          ? null
          : await transaction.webhookDelivery.findUnique({
              where: { id: input.deliveryId },
              select: {
                id: true,
                status: true,
                retryCount: true,
                attempts: {
                  select: {
                    attemptNumber: true,
                  },
                  orderBy: {
                    attemptNumber: "desc",
                  },
                  take: 1,
                },
              },
            });

      const rejectionReason = getRetryRejectionReason({
        delivery,
        actorRole: input.actorRole,
        confirmed: input.confirmed,
      });

      if (rejectionReason) {
        const audit = await transaction.deliveryRetryAudit.create({
          data: {
            deliveryId: delivery?.id,
            requestedDeliveryId: input.deliveryId,
            actorRole: input.actorRole,
            idempotencyKey: input.idempotencyKey,
            outcome: "rejected",
            reason: rejectionReason,
          },
        });

        return toRetryResult(audit, false);
      }

      if (!delivery) {
        throw new Error("A retry cannot be queued without a delivery.");
      }

      const attemptNumber = (delivery.attempts[0]?.attemptNumber ?? 0) + 1;
      const retryCount = delivery.retryCount + 1;

      await transaction.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "pending",
          retryCount,
          attempts: {
            create: {
              attemptNumber,
              status: "pending",
            },
          },
        },
      });

      const audit = await transaction.deliveryRetryAudit.create({
        data: {
          deliveryId: delivery.id,
          requestedDeliveryId: input.deliveryId,
          actorRole: input.actorRole,
          idempotencyKey: input.idempotencyKey,
          outcome: "queued",
          attemptNumber,
          retryCountAfter: retryCount,
        },
      });

      return toRetryResult(audit, false);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const audit = await findExistingRetry(input);

      if (audit) {
        return audit;
      }
    }

    throw error;
  }
}
