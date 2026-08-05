import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import {
  type ParsedKnowledgeDocument,
  parseKnowledgeDirectory,
} from "./markdown-parser.js";
import {
  EMBEDDING_DIMENSIONS,
  OpenAiEmbeddingProvider,
} from "./openai-embedding.provider.js";

export type KnowledgeIngestOptions = {
  knowledgeDirectory: string;
  embeddingModel: string;
  apiKey?: string;
  dryRun: boolean;
};

export type KnowledgeIngestSummary = {
  documents: number;
  chunks: number;
  ingested: number;
  skipped: number;
  dryRun: boolean;
};

function vectorLiteral(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected an embedding with ${EMBEDDING_DIMENSIONS} dimensions.`,
    );
  }

  return `[${embedding.join(",")}]`;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 1_000)
    : "Unknown ingestion error.";
}

async function shouldSkipDocument(
  document: ParsedKnowledgeDocument,
  embeddingModel: string,
) {
  const existingDocument = await prisma.knowledgeDocument.findUnique({
    where: { id: document.id },
    include: {
      _count: {
        select: {
          chunks: true,
        },
      },
    },
  });

  return (
    existingDocument?.checksum === document.checksum &&
    existingDocument.embeddingModel === embeddingModel &&
    existingDocument.embeddingStatus === "ready" &&
    existingDocument._count.chunks === document.chunks.length
  );
}

async function persistDocument(
  document: ParsedKnowledgeDocument,
  embeddingModel: string,
  embeddings: number[][],
) {
  await prisma.$transaction(async (transaction) => {
    await transaction.knowledgeDocument.upsert({
      where: { id: document.id },
      create: {
        id: document.id,
        sourcePath: document.sourcePath,
        title: document.title,
        category: document.category,
        eventTypes: document.eventTypes,
        checksum: document.checksum,
        embeddingModel,
        embeddingStatus: "pending",
        embeddingError: null,
      },
      update: {
        sourcePath: document.sourcePath,
        title: document.title,
        category: document.category,
        eventTypes: document.eventTypes,
        checksum: document.checksum,
        embeddingModel,
        embeddingStatus: "pending",
        embeddingError: null,
      },
    });

    await transaction.knowledgeChunk.deleteMany({
      where: { documentId: document.id },
    });

    for (const [index, chunk] of document.chunks.entries()) {
      const savedChunk = await transaction.knowledgeChunk.create({
        data: {
          documentId: document.id,
          sequence: chunk.sequence,
          title: chunk.title,
          section: chunk.section,
          content: chunk.content,
          eventTypes: chunk.eventTypes,
          tokenEstimate: chunk.tokenEstimate,
          embeddingModel,
          embeddingStatus: "ready",
          embeddingError: null,
        },
      });

      await transaction.$executeRaw(
        Prisma.sql`
          UPDATE "KnowledgeChunk"
          SET "embedding" = ${vectorLiteral(embeddings[index])}::vector
          WHERE "id" = ${savedChunk.id}
        `,
      );
    }

    await transaction.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        embeddingStatus: "ready",
        embeddingError: null,
      },
    });
  });
}

async function recordFailure(
  document: ParsedKnowledgeDocument,
  embeddingModel: string,
  error: unknown,
) {
  await prisma.knowledgeDocument.upsert({
    where: { id: document.id },
    create: {
      id: document.id,
      sourcePath: document.sourcePath,
      title: document.title,
      category: document.category,
      eventTypes: document.eventTypes,
      checksum: document.checksum,
      embeddingModel,
      embeddingStatus: "failed",
      embeddingError: errorMessage(error),
    },
    update: {
      sourcePath: document.sourcePath,
      title: document.title,
      category: document.category,
      eventTypes: document.eventTypes,
      checksum: document.checksum,
      embeddingModel,
      embeddingStatus: "failed",
      embeddingError: errorMessage(error),
    },
  });
}

export async function ingestKnowledge(
  options: KnowledgeIngestOptions,
): Promise<KnowledgeIngestSummary> {
  const documents = await parseKnowledgeDirectory(options.knowledgeDirectory);
  const chunks = documents.reduce(
    (total, document) => total + document.chunks.length,
    0,
  );

  if (options.dryRun) {
    return {
      documents: documents.length,
      chunks,
      ingested: 0,
      skipped: 0,
      dryRun: true,
    };
  }

  if (!options.apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required for ingestion. Use --dry-run to validate documents without embeddings.",
    );
  }

  const provider = new OpenAiEmbeddingProvider(
    options.apiKey,
    options.embeddingModel,
  );
  let ingested = 0;
  let skipped = 0;

  for (const document of documents) {
    if (await shouldSkipDocument(document, options.embeddingModel)) {
      skipped += 1;
      continue;
    }

    try {
      const embeddings = await provider.embed(
        document.chunks.map((chunk) => chunk.embeddingInput),
      );

      if (embeddings.length !== document.chunks.length) {
        throw new Error(
          "Embedding response length does not match the knowledge chunk count.",
        );
      }

      await persistDocument(document, options.embeddingModel, embeddings);
      ingested += 1;
    } catch (error) {
      await recordFailure(document, options.embeddingModel, error);
      throw error;
    }
  }

  return {
    documents: documents.length,
    chunks,
    ingested,
    skipped,
    dryRun: false,
  };
}
