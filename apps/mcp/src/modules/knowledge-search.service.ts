import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { McpToolError } from "./mcp-tool-error.js";
import {
  EMBEDDING_DIMENSIONS,
  OpenAiEmbeddingProvider,
} from "./openai-embedding.provider.js";

const RRF_K = 60;
const MINIMUM_SEMANTIC_SCORE = 0.3;

export const knowledgeCategories = [
  "documentation",
  "runbook",
  "postmortem",
] as const;

export type KnowledgeCategory = (typeof knowledgeCategories)[number];

type RankedChunkRow = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  category: KnowledgeCategory;
  section: string;
  content: string;
  event_types: string[];
  score: number;
};

export type SearchKnowledgeInput = {
  query: string;
  eventType?: string;
  categories?: KnowledgeCategory[];
  limit?: number;
};

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  category: KnowledgeCategory;
  section: string;
  content: string;
  eventTypes: string[];
  semanticScore?: number;
  fullTextScore?: number;
  fusedScore: number;
};

type CombinedResult = Omit<KnowledgeSearchResult, "fusedScore"> & {
  semanticRank?: number;
  fullTextRank?: number;
};

function vectorLiteral(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new McpToolError(
      "EMBEDDING_INVALID",
      "The embedding service returned an unexpected vector size.",
    );
  }

  return `[${embedding.join(",")}]`;
}

function safeScore(score: number) {
  return Number.isFinite(Number(score)) ? Number(score) : 0;
}

function createFilters(input: SearchKnowledgeInput) {
  const categories = input.categories ?? [];
  const categoryFilter =
    categories.length > 0
      ? Prisma.sql`AND d."category"::text IN (${Prisma.join(categories)})`
      : Prisma.empty;
  const eventTypeFilter = input.eventType
    ? Prisma.sql`
        AND (
          ${input.eventType} = ANY (c."eventTypes")
          OR cardinality(c."eventTypes") = 0
        )
      `
    : Prisma.empty;

  return { categoryFilter, eventTypeFilter };
}

function toSearchResult(
  row: RankedChunkRow,
): Omit<KnowledgeSearchResult, "fusedScore"> {
  return {
    chunkId: row.chunk_id,
    documentId: row.document_id,
    title: row.document_title,
    category: row.category,
    section: row.section,
    content: row.content,
    eventTypes: row.event_types,
  };
}

function rrf(rank: number | undefined) {
  return rank ? 1 / (RRF_K + rank) : 0;
}

function fuseResults(
  semanticResults: RankedChunkRow[],
  fullTextResults: RankedChunkRow[],
  limit: number,
) {
  const combined = new Map<string, CombinedResult>();

  semanticResults.forEach((row, index) => {
    const existing = combined.get(row.chunk_id) ?? toSearchResult(row);

    combined.set(row.chunk_id, {
      ...existing,
      semanticRank: index + 1,
      semanticScore: safeScore(row.score),
    });
  });

  fullTextResults.forEach((row, index) => {
    const existing = combined.get(row.chunk_id) ?? toSearchResult(row);

    combined.set(row.chunk_id, {
      ...existing,
      fullTextRank: index + 1,
      fullTextScore: safeScore(row.score),
    });
  });

  return [...combined.values()]
    .filter(
      (result) =>
        result.fullTextRank !== undefined ||
        (result.semanticScore ?? 0) >= MINIMUM_SEMANTIC_SCORE,
    )
    .map(({ semanticRank, fullTextRank, ...result }) => ({
      ...result,
      fusedScore: rrf(semanticRank) + rrf(fullTextRank),
    }))
    .sort((left, right) => right.fusedScore - left.fusedScore)
    .slice(0, limit);
}

export async function searchKnowledge(input: SearchKnowledgeInput) {
  const query = input.query.trim();

  if (!query) {
    return [];
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new McpToolError(
      "AI_CONFIGURATION_REQUIRED",
      "OPENAI_API_KEY is required to search HookLens knowledge.",
    );
  }

  const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);
  const candidateLimit = Math.max(limit * 3, 10);
  const embeddingProvider = new OpenAiEmbeddingProvider(
    apiKey,
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  );
  const [queryEmbedding] = await embeddingProvider.embed([query]);
  const embedding = vectorLiteral(queryEmbedding);
  const { categoryFilter, eventTypeFilter } = createFilters(input);

  const [semanticResults, fullTextResults] = await Promise.all([
    prisma.$queryRaw<RankedChunkRow[]>(Prisma.sql`
      SELECT
        c."id" AS chunk_id,
        d."id" AS document_id,
        d."title" AS document_title,
        d."category"::text AS category,
        c."section" AS section,
        c."content" AS content,
        c."eventTypes" AS event_types,
        1 - (c."embedding" <=> ${embedding}::vector) AS score
      FROM "KnowledgeChunk" c
      INNER JOIN "KnowledgeDocument" d ON d."id" = c."documentId"
      WHERE c."embedding" IS NOT NULL
        AND c."embeddingStatus" = 'ready'
        AND d."embeddingStatus" = 'ready'
        ${categoryFilter}
        ${eventTypeFilter}
      ORDER BY c."embedding" <=> ${embedding}::vector
      LIMIT ${candidateLimit}
    `),
    prisma.$queryRaw<RankedChunkRow[]>(Prisma.sql`
      WITH search_query AS (
        SELECT websearch_to_tsquery('english', ${query}) AS query
      )
      SELECT
        c."id" AS chunk_id,
        d."id" AS document_id,
        d."title" AS document_title,
        d."category"::text AS category,
        c."section" AS section,
        c."content" AS content,
        c."eventTypes" AS event_types,
        ts_rank_cd(c."searchVector", search_query.query) AS score
      FROM "KnowledgeChunk" c
      INNER JOIN "KnowledgeDocument" d ON d."id" = c."documentId"
      CROSS JOIN search_query
      WHERE c."embeddingStatus" = 'ready'
        AND d."embeddingStatus" = 'ready'
        AND c."searchVector" @@ search_query.query
        ${categoryFilter}
        ${eventTypeFilter}
      ORDER BY score DESC
      LIMIT ${candidateLimit}
    `),
  ]);

  return fuseResults(semanticResults, fullTextResults, limit);
}
