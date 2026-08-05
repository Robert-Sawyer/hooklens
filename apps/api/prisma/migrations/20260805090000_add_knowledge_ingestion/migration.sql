CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "KnowledgeCategory" AS ENUM ('documentation', 'runbook', 'postmortem');
CREATE TYPE "KnowledgeEmbeddingStatus" AS ENUM ('pending', 'ready', 'failed');

CREATE TABLE "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "sourcePath" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "KnowledgeCategory" NOT NULL,
  "eventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "checksum" TEXT NOT NULL,
  "embeddingModel" TEXT,
  "embeddingStatus" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'pending',
  "embeddingError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "eventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tokenEstimate" INTEGER NOT NULL,
  "embedding" vector(1536),
  "embeddingModel" TEXT,
  "embeddingStatus" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'pending',
  "embeddingError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KnowledgeChunk_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KnowledgeDocument_sourcePath_key" ON "KnowledgeDocument"("sourcePath");
CREATE INDEX "KnowledgeDocument_category_updatedAt_idx" ON "KnowledgeDocument"("category", "updatedAt");
CREATE INDEX "KnowledgeDocument_embeddingStatus_idx" ON "KnowledgeDocument"("embeddingStatus");
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_sequence_key" ON "KnowledgeChunk"("documentId", "sequence");
CREATE INDEX "KnowledgeChunk_documentId_createdAt_idx" ON "KnowledgeChunk"("documentId", "createdAt");
CREATE INDEX "KnowledgeChunk_embeddingStatus_idx" ON "KnowledgeChunk"("embeddingStatus");
CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx" ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);
