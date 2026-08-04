import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { deliveryRepository } from "./delivery.repository.js";
import {
  deliveryIdParamsSchema,
  deliveryListQuerySchema,
  intakeWebhookSchema,
} from "./delivery.schemas.js";

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
}
