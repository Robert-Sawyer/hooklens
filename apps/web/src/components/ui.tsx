import type { DeliveryStatus, KnowledgeCategory } from "../lib/api";

const statusClass: Record<DeliveryStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
};

const categoryClass: Record<KnowledgeCategory, string> = {
  documentation: "border-indigo-200 bg-indigo-50 text-indigo-700",
  runbook: "border-teal-200 bg-teal-50 text-teal-700",
  postmortem: "border-orange-200 bg-orange-50 text-orange-700",
};

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass[status]}`}
    >
      {status}
    </span>
  );
}

export function CategoryBadge({ category }: { category: KnowledgeCategory }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${categoryClass[category]}`}
    >
      {category}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {description}
      </p>
    </header>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="font-semibold">Unable to load data</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

export function LoadingRows() {
  return (
    <div className="space-y-3 p-5">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-16 animate-pulse rounded-lg bg-slate-100"
        />
      ))}
    </div>
  );
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
