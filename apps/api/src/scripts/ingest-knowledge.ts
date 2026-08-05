import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { ingestKnowledge } from "../modules/knowledge/knowledge-ingest.service.js";

const scriptDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
const knowledgeDirectory = resolve(scriptDirectory, "../../../../knowledge");
const dryRun = process.argv.slice(2).includes("--dry-run");
const embeddingModel =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

try {
  const summary = await ingestKnowledge({
    knowledgeDirectory,
    embeddingModel,
    apiKey: process.env.OPENAI_API_KEY,
    dryRun,
  });

  console.log(
    `${summary.dryRun ? "Validated" : "Ingested"} ${summary.documents} documents and ${summary.chunks} chunks (${summary.ingested} ingested, ${summary.skipped} skipped).`,
  );
} finally {
  const { prisma } = await import("../db/prisma.js");
  await prisma.$disconnect();
}
