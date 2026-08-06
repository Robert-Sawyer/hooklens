"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  getDelivery,
  getDeliveryDiagnosis,
  HookLensApiError,
  requestRetry,
  type DeliveryDiagnosis,
} from "../lib/api";
import {
  ErrorPanel,
  formatDate,
  getErrorMessage,
  LoadingRows,
  PageHeader,
  prettyJson,
  StatusBadge,
} from "./ui";

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DiagnosisPanel({ deliveryId }: { deliveryId: string }) {
  const diagnosisMutation = useMutation({
    mutationFn: () => getDeliveryDiagnosis(deliveryId),
  });
  const diagnosis = diagnosisMutation.data?.data;

  return (
    <Section
      title="AI diagnosis"
      action={
        <button
          type="button"
          onClick={() => diagnosisMutation.mutate()}
          disabled={diagnosisMutation.isPending}
          className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
        >
          {diagnosisMutation.isPending
            ? "Retrieving evidence…"
            : "Diagnose failure"}
        </button>
      }
    >
      <div className="p-5">
        {!diagnosis && !diagnosisMutation.isError ? (
          <div className="rounded-xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">
            <p className="font-semibold">Source-backed diagnostic workflow</p>
            <p className="mt-1">
              HookLens will retrieve matching knowledge, redact sensitive fields
              and explain the most likely cause with document references. It
              never queues a retry here.
            </p>
          </div>
        ) : null}
        {diagnosisMutation.isError ? (
          <ErrorPanel
            message={getErrorMessage(
              diagnosisMutation.error,
              "Diagnosis request failed.",
            )}
          />
        ) : null}
        {diagnosis ? <DiagnosisResult diagnosis={diagnosis} /> : null}
      </div>
    </Section>
  );
}

function DiagnosisResult({ diagnosis }: { diagnosis: DeliveryDiagnosis }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-600">
          Retrieval query
        </p>
        <p className="mt-2 text-sm text-slate-700">
          {diagnosis.retrievalQuery}
        </p>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
        {diagnosis.diagnosis}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Sources
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {diagnosis.sources.map((source) => (
            <div
              key={`${source.documentId}-${source.section}`}
              className="rounded-lg border border-slate-200 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                {source.category}
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {source.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{source.section}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getRetryErrorMessage(error: unknown) {
  if (error instanceof HookLensApiError) {
    return `${error.code ?? "RETRY_REJECTED"}: ${error.message}`;
  }

  return getErrorMessage(error, "Retry request failed.");
}

function RetryPanel({
  deliveryId,
  status,
  retryCount,
}: {
  deliveryId: string;
  status: string;
  retryCount: number;
}) {
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const retryMutation = useMutation({
    mutationFn: () => requestRetry(deliveryId, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["delivery", deliveryId],
      });
      void queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      setConfirmed(false);
    },
  });
  const disabled = status !== "failed" || retryCount >= 3;

  return (
    <Section title="Safe retry">
      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-semibold">
            Operator action — local portfolio demo
          </p>
          <p className="mt-1">
            A retry adds a pending attempt and audit record. It does not send an
            outbound webhook. A successful or pending delivery, or one with
            three retries, cannot be queued again.
          </p>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={disabled || retryMutation.isPending}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-4 accent-indigo-600"
          />
          <span>
            I confirmed with the user that this failed delivery should be queued
            for retry.
          </span>
        </label>
        <button
          type="button"
          disabled={disabled || !confirmed || retryMutation.isPending}
          onClick={() => retryMutation.mutate()}
          className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {retryMutation.isPending ? "Queueing retry…" : "Queue retry"}
        </button>
        {disabled ? (
          <p className="text-sm text-slate-500">
            Retry unavailable: current status is {status}, retry count is{" "}
            {retryCount}/3.
          </p>
        ) : null}
        {retryMutation.isSuccess ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Retry queued. Attempt {retryMutation.data.data.attemptNumber} is now
            pending.
          </p>
        ) : null}
        {retryMutation.isError ? (
          <ErrorPanel message={getRetryErrorMessage(retryMutation.error)} />
        ) : null}
      </div>
    </Section>
  );
}

export function DeliveryDetailView() {
  const params = useParams<{ deliveryId: string }>();
  const deliveryId = params.deliveryId;
  const deliveryQuery = useQuery({
    queryKey: ["delivery", deliveryId],
    queryFn: () => getDelivery(deliveryId),
    enabled: Boolean(deliveryId),
  });
  const delivery = deliveryQuery.data?.data;

  if (deliveryQuery.isLoading) {
    return <LoadingRows />;
  }

  if (deliveryQuery.isError || !delivery) {
    return (
      <section>
        <Link
          href="/deliveries"
          className="text-sm font-semibold text-indigo-700 hover:underline"
        >
          ← Back to deliveries
        </Link>
        <div className="mt-6">
          <ErrorPanel
            message={getErrorMessage(
              deliveryQuery.error,
              "Delivery was not found.",
            )}
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <Link
        href="/deliveries"
        className="text-sm font-semibold text-indigo-700 hover:underline"
      >
        ← Back to deliveries
      </Link>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          eyebrow="Delivery details"
          title={delivery.event.eventType}
          description={`${delivery.targetUrl} · ${delivery.id}`}
        />
        <StatusBadge status={delivery.status} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.8fr)]">
        <div className="space-y-5">
          <Section title="Request and receiver response">
            <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Request headers
                </p>
                <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {prettyJson(delivery.requestHeaders)}
                </pre>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Payload
                </p>
                <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {prettyJson(delivery.event.payload)}
                </pre>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Latest response
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {delivery.lastHttpStatus ?? "—"}
                </p>
                <pre className="mt-3 rounded-lg bg-slate-100 p-4 text-xs leading-5 text-slate-700">
                  {delivery.lastResponseBody ?? "No response body captured."}
                </pre>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Retries</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {delivery.retryCount}/3
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Captured</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {formatDate(delivery.createdAt)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </Section>

          <Section title="Attempt timeline">
            <ol className="divide-y divide-slate-100">
              {delivery.attempts.map((attempt) => (
                <li
                  key={attempt.id}
                  className="grid gap-3 p-5 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="font-mono text-xs font-bold text-indigo-600">
                    #{attempt.attemptNumber}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {attempt.httpStatus ?? "No status"}
                      {attempt.responseBody ? ` · ${attempt.responseBody}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {attempt.durationMs === null
                        ? "Duration unavailable"
                        : `${attempt.durationMs} ms`}{" "}
                      · {formatDate(attempt.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={attempt.status} />
                </li>
              ))}
            </ol>
          </Section>

          <DiagnosisPanel deliveryId={delivery.id} />
        </div>

        <div className="space-y-5">
          <RetryPanel
            deliveryId={delivery.id}
            status={delivery.status}
            retryCount={delivery.retryCount}
          />
          <Section title="Retry audit">
            {delivery.retryAudits.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">
                No retry audit records yet.
              </p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {delivery.retryAudits.map((audit) => (
                  <li key={audit.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold capitalize text-slate-800">
                        {audit.outcome}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(audit.createdAt)}
                      </p>
                    </div>
                    <p className="mt-1 text-slate-600">
                      {audit.reason ??
                        `Attempt ${audit.attemptNumber} queued by ${audit.actorRole}.`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </div>
    </section>
  );
}
