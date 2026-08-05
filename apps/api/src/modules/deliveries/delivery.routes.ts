import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { diagnoseDeliveryFailure } from "./delivery-diagnosis.service.js";
import { deliveryRepository } from "./delivery.repository.js";
import {
  diagnosisQuerySchema,
  deliveryIdParamsSchema,
  deliveryListQuerySchema,
  intakeWebhookSchema,
  retryDeliverySchema,
} from "./delivery.schemas.js";
import {
  requestDeliveryRetry,
  resolveRetryActorRole,
  retryRejectionMessages,
  retryRejectionStatus,
  retryRoleHeader,
} from "./retry.service.js";

function sendValidationError(reply: FastifyReply, error: ZodError) {
  return reply.status(400).send({
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: error.flatten(),
    },
  });
}

export async function deliveryRoutes(app: FastifyInstance) {
  app.post("/api/v1/webhooks", async (request, reply) => {
    const parsedBody = intakeWebhookSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    const delivery = await deliveryRepository.createFromIntake(parsedBody.data);

    return reply.status(201).send({ data: delivery });
  });

  app.get("/api/v1/deliveries", async (request, reply) => {
    const parsedQuery = deliveryListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, parsedQuery.error);
    }

    const { deliveries, total } = await deliveryRepository.list(
      parsedQuery.data,
    );

    return reply.send({
      data: deliveries,
      meta: {
        page: parsedQuery.data.page,
        pageSize: parsedQuery.data.pageSize,
        total,
        totalPages: Math.ceil(total / parsedQuery.data.pageSize),
      },
    });
  });

  app.get("/api/v1/deliveries/:deliveryId", async (request, reply) => {
    const parsedParams = deliveryIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, parsedParams.error);
    }

    const delivery = await deliveryRepository.findById(
      parsedParams.data.deliveryId,
    );

    if (!delivery) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Delivery not found.",
        },
      });
    }

    return reply.send({ data: delivery });
  });

  app.post("/api/v1/deliveries/:deliveryId/retry", async (request, reply) => {
    const parsedParams = deliveryIdParamsSchema.safeParse(request.params);
    const parsedBody = retryDeliverySchema.safeParse(request.body);

    if (!parsedParams.success) {
      return sendValidationError(reply, parsedParams.error);
    }

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    const result = await requestDeliveryRetry({
      ...parsedBody.data,
      deliveryId: parsedParams.data.deliveryId,
      actorRole: resolveRetryActorRole(request.headers[retryRoleHeader]),
    });

    if (result.kind === "rejected") {
      return reply.status(retryRejectionStatus(result.reason)).send({
        error: {
          code: result.reason,
          message: retryRejectionMessages[result.reason],
          auditId: result.auditId,
        },
        meta: {
          idempotentReplay: result.replayed,
        },
      });
    }

    return reply.status(result.replayed ? 200 : 202).send({
      data: {
        deliveryId: result.deliveryId,
        status: "pending",
        attemptNumber: result.attemptNumber,
        retryCount: result.retryCount,
        auditId: result.auditId,
      },
      meta: {
        idempotentReplay: result.replayed,
      },
    });
  });

  app.post(
    "/api/v1/deliveries/:deliveryId/diagnosis",
    async (request, reply) => {
      const parsedParams = deliveryIdParamsSchema.safeParse(request.params);
      const parsedQuery = diagnosisQuerySchema.safeParse(request.query);

      if (!parsedParams.success) {
        return sendValidationError(reply, parsedParams.error);
      }

      if (!parsedQuery.success) {
        return sendValidationError(reply, parsedQuery.error);
      }

      try {
        const result = await diagnoseDeliveryFailure({
          deliveryId: parsedParams.data.deliveryId,
          includePayload: parsedQuery.data.includePayload,
          apiKey: process.env.OPENAI_API_KEY,
          embeddingModel:
            process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
          diagnosisModel: process.env.OPENAI_DIAGNOSIS_MODEL ?? "gpt-5.6-terra",
        });

        if (result.kind === "not-found") {
          return reply.status(404).send({
            error: {
              code: "NOT_FOUND",
              message: "Delivery not found.",
            },
          });
        }

        if (result.kind === "not-failed") {
          return reply.status(409).send({
            error: {
              code: "DELIVERY_NOT_FAILED",
              message: `Only failed deliveries can be diagnosed. Current status: ${result.status}.`,
            },
          });
        }

        return reply.send({ data: result });
      } catch (error) {
        request.log.error(error, "Delivery diagnosis failed");

        return reply.status(503).send({
          error: {
            code: "DIAGNOSIS_UNAVAILABLE",
            message:
              "The diagnosis service is temporarily unavailable. Check the local AI configuration and try again.",
          },
        });
      }
    },
  );
}
