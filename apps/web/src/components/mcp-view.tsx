import { PageHeader } from "./ui";

const capabilities = [
  {
    type: "Resources",
    detail:
      "Deliveries, events, documents and runbooks as redacted references.",
    entries: [
      "hooklens://deliveries/{deliveryId}",
      "hooklens://events/{eventId}",
      "hooklens://documents/{documentId}",
      "hooklens://runbooks/{runbookId}",
    ],
  },
  {
    type: "Tools",
    detail:
      "Operational reads, hybrid retrieval, diagnosis and a separately guarded retry.",
    entries: [
      "get_delivery_details",
      "search_knowledge",
      "diagnose_delivery_failure",
      "retry_webhook_delivery",
    ],
  },
  {
    type: "Prompts",
    detail: "Reusable client workflows that keep investigation evidence-based.",
    entries: [
      "diagnose-webhook-failure",
      "prepare-integration-checklist",
      "review-retry-storm",
    ],
  },
];

export function McpView() {
  return (
    <section>
      <PageHeader
        eyebrow="AI client integration"
        title="MCP server"
        description="HookLens exposes the same operational evidence to compatible AI clients through Streamable HTTP."
      />

      <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-300">
          Local endpoint
        </p>
        <code className="mt-3 block break-all text-xl font-semibold tracking-tight text-white sm:text-2xl">
          http://127.0.0.1:4001/mcp
        </code>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
          Run{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-white">
            pnpm mcp:dev
          </code>{" "}
          in a separate terminal, then configure this URL in an MCP-compatible
          client.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {capabilities.map((capability) => (
          <section
            key={capability.type}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
              {capability.type}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {capability.detail}
            </p>
            <ul className="mt-5 space-y-2">
              {capability.entries.map((entry) => (
                <li
                  key={entry}
                  className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
                >
                  {entry}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Retry safety boundary</p>
        <p className="mt-1">
          Diagnosis tools are read-only. The retry tool is deliberately
          separate, requires user confirmation and an idempotency key, and is
          disabled unless the local MCP operator flag is enabled. It queues an
          auditable attempt rather than sending a real external webhook.
        </p>
      </section>
    </section>
  );
}
