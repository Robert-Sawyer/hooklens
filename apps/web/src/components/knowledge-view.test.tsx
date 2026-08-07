import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getKnowledgeDocument, getKnowledgeDocuments } from "../lib/api";
import { knowledgeDocumentDetails, knowledgeDocuments } from "../test/fixtures";
import { renderWithQueryClient } from "../test/test-utils";
import { KnowledgeView } from "./knowledge-view";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();

  return {
    ...actual,
    getKnowledgeDocument: vi.fn(),
    getKnowledgeDocuments: vi.fn(),
  };
});

const getKnowledgeDocumentMock = vi.mocked(getKnowledgeDocument);
const getKnowledgeDocumentsMock = vi.mocked(getKnowledgeDocuments);

describe("KnowledgeView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKnowledgeDocumentsMock.mockImplementation(async (category) => ({
      data: category
        ? knowledgeDocuments.filter(
            (document) => document.category === category,
          )
        : knowledgeDocuments,
    }));
    getKnowledgeDocumentMock.mockImplementation(async (documentId) => ({
      data: knowledgeDocumentDetails[documentId],
    }));
  });

  it("loads the first document and changes the list when a category is selected", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(<KnowledgeView />);

    expect(
      await screen.findByText("Raw payload verification"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "runbook" }));

    await waitFor(() => {
      expect(getKnowledgeDocumentsMock).toHaveBeenLastCalledWith("runbook");
    });
    expect(
      await screen.findByRole("heading", {
        name: "Invalid Signature Runbook",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Check the active secret"),
    ).toBeInTheDocument();
  });
});
