ALTER TABLE "KnowledgeChunk"
ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  to_tsvector(
    'english',
    coalesce("title", '') || ' ' ||
    coalesce("section", '') || ' ' ||
    coalesce("content", '')
  )
) STORED;

CREATE INDEX "KnowledgeChunk_searchVector_gin_idx"
ON "KnowledgeChunk" USING GIN ("searchVector");
