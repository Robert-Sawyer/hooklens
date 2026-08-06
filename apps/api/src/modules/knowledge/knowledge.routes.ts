import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { knowledgeRepository } from "./knowledge.repository.js";
import {
  knowledgeDocumentParamsSchema,
  knowledgeListQuerySchema,
} from "./knowledge.schemas.js";

function sendValidationError(reply: FastifyReply, error: ZodError) {
  return reply.status(400).send({
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: error.flatten(),
    },
  });
}

export async function knowledgeRoutes(app: FastifyInstance) {
  app.get("/api/v1/knowledge/documents", async (request, reply) => {
    const parsedQuery = knowledgeListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, parsedQuery.error);
    }

    const documents = await knowledgeRepository.list(parsedQuery.data.category);

    return reply.send({
      data: documents.map(({ _count, ...document }) => ({
        ...document,
        chunkCount: _count.chunks,
      })),
    });
  });

  app.get("/api/v1/knowledge/documents/:documentId", async (request, reply) => {
    const parsedParams = knowledgeDocumentParamsSchema.safeParse(
      request.params,
    );

    if (!parsedParams.success) {
      return sendValidationError(reply, parsedParams.error);
    }

    const document = await knowledgeRepository.findById(
      parsedParams.data.documentId,
    );

    if (!document) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Knowledge document not found.",
        },
      });
    }

    const { _count, ...data } = document;

    return reply.send({
      data: {
        ...data,
        chunkCount: _count.chunks,
      },
    });
  });
}
