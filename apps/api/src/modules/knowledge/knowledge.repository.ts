import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

type KnowledgeCategory = "documentation" | "runbook" | "postmortem";

const documentSummarySelect = {
  id: true,
  sourcePath: true,
  title: true,
  category: true,
  eventTypes: true,
  embeddingStatus: true,
  updatedAt: true,
  _count: {
    select: {
      chunks: true,
    },
  },
} satisfies Prisma.KnowledgeDocumentSelect;

export const knowledgeRepository = {
  async list(category?: KnowledgeCategory) {
    return prisma.knowledgeDocument.findMany({
      where: category ? { category } : undefined,
      select: documentSummarySelect,
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });
  },

  async findById(documentId: string) {
    return prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      select: {
        ...documentSummarySelect,
        chunks: {
          select: {
            id: true,
            sequence: true,
            section: true,
            content: true,
            eventTypes: true,
            tokenEstimate: true,
            embeddingStatus: true,
          },
          orderBy: {
            sequence: "asc",
          },
        },
      },
    });
  },
};
