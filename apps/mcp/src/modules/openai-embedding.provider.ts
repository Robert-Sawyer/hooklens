import OpenAI from "openai";

export const EMBEDDING_DIMENSIONS = 1536;

export class OpenAiEmbeddingProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(input: string[]) {
    const response = await this.client.embeddings.create({
      model: this.model,
      input,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data.map((item) => item.embedding);
  }
}
