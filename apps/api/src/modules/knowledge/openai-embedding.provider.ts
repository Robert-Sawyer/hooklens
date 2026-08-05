import OpenAI from "openai";

export const EMBEDDING_DIMENSIONS = 1_536;
const MAX_INPUTS_PER_REQUEST = 64;

export class OpenAiEmbeddingProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(inputs: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (
      let start = 0;
      start < inputs.length;
      start += MAX_INPUTS_PER_REQUEST
    ) {
      const inputBatch = inputs.slice(start, start + MAX_INPUTS_PER_REQUEST);
      const response = await this.client.embeddings.create({
        model: this.model,
        input: inputBatch,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: "float",
      });

      const orderedBatch = [...response.data].sort(
        (left, right) => left.index - right.index,
      );

      for (const item of orderedBatch) {
        if (
          item.embedding.length !== EMBEDDING_DIMENSIONS ||
          item.embedding.some((value) => !Number.isFinite(value))
        ) {
          throw new Error(
            `Expected a ${EMBEDDING_DIMENSIONS}-dimension numeric embedding from ${this.model}.`,
          );
        }

        embeddings.push(item.embedding);
      }
    }

    return embeddings;
  }
}
