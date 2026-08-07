"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getKnowledgeDocument,
  getKnowledgeDocuments,
  type KnowledgeCategory,
} from "../lib/api";
import {
  CategoryBadge,
  ErrorPanel,
  formatDate,
  getErrorMessage,
  LoadingRows,
  PageHeader,
} from "./ui";

const categories: Array<"" | KnowledgeCategory> = [
  "",
  "documentation",
  "runbook",
  "postmortem",
];

export function KnowledgeView() {
  const [category, setCategory] = useState<"" | KnowledgeCategory>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const documentsQuery = useQuery({
    queryKey: ["knowledge-documents", category],
    queryFn: () => getKnowledgeDocuments(category || undefined),
  });
  const documents = documentsQuery.data?.data ?? [];
  const activeDocumentId = selectedId ?? documents[0]?.id;
  const documentQuery = useQuery({
    queryKey: ["knowledge-document", activeDocumentId],
    queryFn: () => getKnowledgeDocument(activeDocumentId ?? ""),
    enabled: Boolean(activeDocumentId),
  });

  return (
    <section>
      <PageHeader
        eyebrow="RAG sources"
        title="Knowledge base"
        description="Browse the fictional integration documentation that is parsed, chunked and embedded for retrieval."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            key={item || "all"}
            type="button"
            onClick={() => {
              setCategory(item);
              setSelectedId(null);
            }}
            className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              category === item
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
            }`}
          >
            {item || "All documents"}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Documents</h2>
            <p className="mt-1 text-sm text-slate-500">
              {documents.length} available
            </p>
          </div>
          {documentsQuery.isLoading ? <LoadingRows /> : null}
          {documentsQuery.isError ? (
            <div className="p-5">
              <ErrorPanel
                message={getErrorMessage(
                  documentsQuery.error,
                  "Unable to load documents.",
                )}
              />
            </div>
          ) : null}
          {documents.map((document) => (
            <button
              key={document.id}
              type="button"
              onClick={() => setSelectedId(document.id)}
              className={`w-full border-b border-slate-100 p-4 text-left transition last:border-b-0 ${
                activeDocumentId === document.id
                  ? "bg-indigo-50"
                  : "hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-800">{document.title}</p>
                <CategoryBadge category={document.category} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {document.chunkCount} chunks · {document.embeddingStatus}
              </p>
            </button>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!activeDocumentId ? (
            <div className="grid min-h-80 place-items-center p-8 text-center">
              <div>
                <p className="font-semibold text-slate-800">
                  No document selected
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a document from the list.
                </p>
              </div>
            </div>
          ) : null}
          {documentQuery.isLoading ? <LoadingRows /> : null}
          {documentQuery.isError ? (
            <div className="p-5">
              <ErrorPanel
                message={getErrorMessage(
                  documentQuery.error,
                  "Unable to load the selected document.",
                )}
              />
            </div>
          ) : null}
          {documentQuery.data ? (
            <div>
              <header className="border-b border-slate-200 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <CategoryBadge category={documentQuery.data.data.category} />
                  <span className="text-xs text-slate-500">
                    Updated {formatDate(documentQuery.data.data.updatedAt)}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                  {documentQuery.data.data.title}
                </h2>
                <p className="mt-2 font-mono text-xs text-slate-500">
                  {documentQuery.data.data.sourcePath}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {documentQuery.data.data.eventTypes.map((eventType) => (
                    <span
                      key={eventType}
                      className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600"
                    >
                      {eventType}
                    </span>
                  ))}
                </div>
              </header>
              <div className="divide-y divide-slate-100">
                {documentQuery.data.data.chunks.map((chunk) => (
                  <article key={chunk.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-800">
                        {chunk.section}
                      </h3>
                      <p className="font-mono text-xs text-slate-500">
                        Chunk {chunk.sequence} · ~{chunk.tokenEstimate} tokens
                      </p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {chunk.content}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
