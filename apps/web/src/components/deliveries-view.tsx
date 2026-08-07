"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  getDeliveries,
  type DeliveryStatus,
  type DeliveryListItem,
} from "../lib/api";
import {
  ErrorPanel,
  formatDate,
  getErrorMessage,
  LoadingRows,
  PageHeader,
  StatusBadge,
} from "./ui";

type DeliveryFilters = {
  status: "" | DeliveryStatus;
  eventType: string;
};

function ResponseSummary({ delivery }: { delivery: DeliveryListItem }) {
  const latestAttempt = delivery.attempts[0];
  const response = latestAttempt?.responseBody ?? delivery.lastResponseBody;

  return (
    <div>
      <p className="font-medium text-slate-800">
        {delivery.lastHttpStatus ?? "—"}
        {response ? ` · ${response}` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {latestAttempt
          ? `Attempt ${latestAttempt.attemptNumber}`
          : "No attempts"}
      </p>
    </div>
  );
}

export function DeliveriesView() {
  const [filters, setFilters] = useState<DeliveryFilters>({
    status: "",
    eventType: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", page, appliedFilters],
    queryFn: () =>
      getDeliveries({
        page,
        status: appliedFilters.status || undefined,
        eventType: appliedFilters.eventType,
      }),
  });

  function applyFilters() {
    setPage(1);
    setAppliedFilters(filters);
  }

  function clearFilters() {
    const emptyFilters = { status: "" as const, eventType: "" };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  const result = deliveriesQuery.data;

  return (
    <section>
      <PageHeader
        eyebrow="Delivery operations"
        title="Webhook deliveries"
        description="Inspect the latest outcome, retry history and receiver response for each captured delivery."
      />

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)_auto_auto] md:items-end">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Status
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as DeliveryFilters["status"],
                }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-200 focus:ring-4"
            >
              <option value="">All statuses</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Event type
            <input
              value={filters.eventType}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  eventType: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyFilters();
                }
              }}
              placeholder="payment.completed"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 placeholder:text-slate-400 focus:ring-4"
            />
          </label>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Captured deliveries
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {result
                ? `${result.meta.total} matching records`
                : "Loading records…"}
            </p>
          </div>
          {deliveriesQuery.isFetching && !deliveriesQuery.isLoading ? (
            <span className="text-xs font-medium text-indigo-600">
              Refreshing…
            </span>
          ) : null}
        </div>

        {deliveriesQuery.isLoading ? <LoadingRows /> : null}
        {deliveriesQuery.isError ? (
          <div className="p-5">
            <ErrorPanel
              message={getErrorMessage(
                deliveriesQuery.error,
                "Unknown request error.",
              )}
            />
          </div>
        ) : null}
        {result && result.data.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-slate-800">
              No deliveries match these filters.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try another event type or clear the status filter.
            </p>
          </div>
        ) : null}
        {result && result.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Event</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Receiver response</th>
                  <th className="px-5 py-3 font-semibold">Captured</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.data.map((delivery) => (
                  <tr
                    key={delivery.id}
                    className="transition hover:bg-indigo-50/40"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {delivery.event.eventType}
                      </p>
                      <p className="mt-1 max-w-56 truncate font-mono text-xs text-slate-500">
                        {delivery.targetUrl}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={delivery.status} />
                      <p className="mt-2 text-xs text-slate-500">
                        Retries: {delivery.retryCount}/3
                      </p>
                    </td>
                    <td className="max-w-72 px-5 py-4">
                      <ResponseSummary delivery={delivery} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDate(delivery.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/deliveries/${delivery.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-white hover:text-indigo-700"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {result && result.meta.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
            <p className="text-slate-500">
              Page {result.meta.page} of {result.meta.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= result.meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
