import { z } from "zod";

const knowledgeCategorySchema = z.enum([
  "documentation",
  "runbook",
  "postmortem",
]);

export const knowledgeListQuerySchema = z.object({
  category: knowledgeCategorySchema.optional(),
});

export const knowledgeDocumentParamsSchema = z.object({
  documentId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
