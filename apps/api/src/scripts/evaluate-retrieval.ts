import { prisma } from "../db/prisma.js";
import { searchKnowledge } from "../modules/knowledge/knowledge-search.service.js";
import { retrievalEvaluationCases } from "../modules/knowledge/retrieval-evaluation.fixture.js";

const TOP_K = 3;
const MINIMUM_HIT_RATE = 0.8;

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to evaluate retrieval.");
  }

  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const sourceCases = retrievalEvaluationCases.filter(
    (evaluationCase) => !evaluationCase.expectNoResult,
  );
  const noResultCases = retrievalEvaluationCases.filter(
    (evaluationCase) => evaluationCase.expectNoResult,
  );
  let sourceHits = 0;
  let noResultPasses = 0;
  const durations: number[] = [];
  const failures: string[] = [];

  for (const evaluationCase of retrievalEvaluationCases) {
    const startedAt = performance.now();
    const results = await searchKnowledge({
      query: evaluationCase.question,
      eventType: evaluationCase.eventType,
      categories: evaluationCase.categories,
      limit: TOP_K,
      apiKey,
      embeddingModel,
    });
    const duration = performance.now() - startedAt;
    durations.push(duration);
    const documentIds = results.map((result) => result.documentId);

    if (evaluationCase.expectNoResult) {
      if (documentIds.length === 0) {
        noResultPasses += 1;
      } else {
        const formattedResults = results
          .map(
            (result) =>
              `${result.documentId} (semantic ${result.semanticScore?.toFixed(2) ?? "n/a"}, text ${result.fullTextScore?.toFixed(2) ?? "n/a"})`,
          )
          .join(", ");

        failures.push(
          `Unexpected result for no-answer question: ${evaluationCase.question} -> ${formattedResults}`,
        );
      }

      continue;
    }

    const matchedDocument = evaluationCase.expectedDocumentIds.find(
      (documentId) => documentIds.includes(documentId),
    );

    if (matchedDocument) {
      sourceHits += 1;
    } else {
      failures.push(
        `Missing expected source for: ${evaluationCase.question} -> got ${documentIds.join(", ") || "no results"}`,
      );
    }
  }

  const hitRate = sourceHits / sourceCases.length;
  const averageLatency =
    durations.reduce((total, duration) => total + duration, 0) /
    durations.length;

  console.log(`Questions:             ${retrievalEvaluationCases.length}`);
  console.log(
    `Expected source in top ${TOP_K}: ${sourceHits}/${sourceCases.length}`,
  );
  console.log(`Retrieval hit rate:    ${(hitRate * 100).toFixed(0)}%`);
  console.log(
    `No-answer checks:      ${noResultPasses}/${noResultCases.length}`,
  );
  console.log(`Average latency:       ${averageLatency.toFixed(0)} ms`);

  if (failures.length > 0) {
    console.error("\nFailures:");
    failures.forEach((failure) => console.error(`- ${failure}`));
  }

  if (hitRate < MINIMUM_HIT_RATE || noResultPasses !== noResultCases.length) {
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
