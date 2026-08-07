import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseKnowledgeDirectory } from "./markdown-parser.js";

const knowledgeDirectory = fileURLToPath(
  new URL("../../../../../knowledge/", import.meta.url),
);

describe("parseKnowledgeDirectory", () => {
  it("turns repository Markdown into ordered, source-addressable chunks", async () => {
    const documents = await parseKnowledgeDirectory(knowledgeDirectory);
    const invalidSignature = documents.find(
      (document) => document.id === "invalid-signature",
    );

    expect(documents.map((document) => document.id)).toEqual(
      [...documents.map((document) => document.id)].sort(),
    );
    expect(invalidSignature).toMatchObject({
      sourcePath: "runbooks/invalid-signature.md",
      title: "Invalid signature runbook",
      category: "runbook",
      eventTypes: [
        "payment.completed",
        "subscription.cancelled",
        "user.created",
      ],
    });
    expect(invalidSignature?.chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sequence: 2,
          section: "Diagnostic steps",
          content: expect.stringContaining("raw request body"),
          embeddingInput: expect.stringContaining("Section: Diagnostic steps"),
        }),
      ]),
    );
    expect(invalidSignature?.chunks.map((chunk) => chunk.sequence)).toEqual(
      invalidSignature?.chunks.map((_, index) => index + 1),
    );
  });
});
