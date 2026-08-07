import { describe, expect, it, vi } from "vitest";
import type { KnowledgeSearchResult } from "../knowledge/knowledge-search.service.js";
import {
  diagnoseDeliveryFailure,
  type DeliveryDiagnosisDependencies,
} from "./delivery-diagnosis.service.js";

type DeliveryDetail = NonNullable<
  Awaited<ReturnType<DeliveryDiagnosisDependencies["findDelivery"]>>
>;

function deliveryFixture(status = "failed") {
  return {
    id: "delivery-401",
    status,
    targetUrl:
      "https://receiver.example.test/hooks/payments?token=do-not-share",
    requestHeaders: {
      authorization: "Bearer sk_live_request_secret",
    },
    lastHttpStatus: 401,
    lastResponseBody: "Invalid signature whsec_receiver_secret",
    retryCount: 1,
    event: {
      eventType: "payment.completed",
      payload: {
        paymentId: "pay_demo_001",
        signingSecret: "whsec_payload_secret",
      },
    },
    attempts: [
      {
        attemptNumber: 1,
        status: "failed",
        httpStatus: 401,
        responseBody: "Authorization: Bearer sk_live_attempt_secret",
        durationMs: 118,
      },
    ],
  } as unknown as DeliveryDetail;
}

function dependenciesFor(delivery: DeliveryDetail | null) {
  const findDelivery = vi.fn().mockResolvedValue(delivery);
  const searchKnowledge = vi.fn().mockResolvedValue([]);
  const diagnose = vi.fn().mockResolvedValue("Model diagnosis");

  return {
    dependencies: {
      findDelivery,
      searchKnowledge,
      diagnose,
    } as unknown as DeliveryDiagnosisDependencies,
    findDelivery,
    searchKnowledge,
    diagnose,
  };
}

const diagnosisOptions = {
  deliveryId: "delivery-401",
  includePayload: false,
  apiKey: "test-api-key",
  embeddingModel: "test-embedding-model",
  diagnosisModel: "test-diagnosis-model",
};

describe("diagnoseDeliveryFailure", () => {
  it("does not call AI dependencies for a missing or non-failed delivery", async () => {
    const missing = dependenciesFor(null);
    const pending = dependenciesFor(deliveryFixture("pending"));

    await expect(
      diagnoseDeliveryFailure(diagnosisOptions, missing.dependencies),
    ).resolves.toEqual({ kind: "not-found" });
    await expect(
      diagnoseDeliveryFailure(diagnosisOptions, pending.dependencies),
    ).resolves.toEqual({ kind: "not-failed", status: "pending" });

    expect(missing.searchKnowledge).not.toHaveBeenCalled();
    expect(missing.diagnose).not.toHaveBeenCalled();
    expect(pending.searchKnowledge).not.toHaveBeenCalled();
    expect(pending.diagnose).not.toHaveBeenCalled();
  });

  it("returns the safe no-evidence response without asking the diagnosis model", async () => {
    const services = dependenciesFor(deliveryFixture());

    const result = await diagnoseDeliveryFailure(
      diagnosisOptions,
      services.dependencies,
    );

    expect(result).toMatchObject({
      kind: "diagnosed",
      deliveryId: "delivery-401",
      eventType: "payment.completed",
      httpStatus: 401,
      sources: [],
    });
    expect(services.searchKnowledge).toHaveBeenCalledWith({
      query: expect.stringContaining("Invalid signature"),
      eventType: "payment.completed",
      categories: ["documentation", "runbook", "postmortem"],
      limit: 5,
      apiKey: "test-api-key",
      embeddingModel: "test-embedding-model",
    });
    expect(services.diagnose).not.toHaveBeenCalled();
  });

  it("uses redacted context and returns unique deterministic sources", async () => {
    const services = dependenciesFor(deliveryFixture());
    const knowledge: KnowledgeSearchResult[] = [
      {
        chunkId: "chunk-signatures-1",
        documentId: "webhook-signatures",
        title: "Webhook signatures",
        category: "documentation",
        section: "Raw payload verification",
        content: "Verify the raw request body before JSON parsing.",
        eventTypes: ["payment.completed"],
        fusedScore: 0.04,
      },
      {
        chunkId: "chunk-signatures-2",
        documentId: "webhook-signatures",
        title: "Webhook signatures",
        category: "documentation",
        section: "Raw payload verification",
        content: "Never transform the signed body.",
        eventTypes: ["payment.completed"],
        fusedScore: 0.03,
      },
      {
        chunkId: "chunk-runbook-1",
        documentId: "invalid-signature",
        title: "Invalid signature runbook",
        category: "runbook",
        section: "Diagnostic steps",
        content: "Compare the active secret with the sender configuration.",
        eventTypes: ["payment.completed"],
        fusedScore: 0.02,
      },
    ];
    services.searchKnowledge.mockResolvedValue(knowledge);
    services.diagnose.mockResolvedValue(
      "Sprawdź sekret i weryfikację surowego body.",
    );

    const result = await diagnoseDeliveryFailure(
      { ...diagnosisOptions, includePayload: true },
      services.dependencies,
    );

    expect(result).toMatchObject({
      kind: "diagnosed",
      diagnosis: "Sprawdź sekret i weryfikację surowego body.",
      sources: [
        {
          documentId: "webhook-signatures",
          section: "Raw payload verification",
        },
        {
          documentId: "invalid-signature",
          section: "Diagnostic steps",
        },
      ],
    });

    const diagnosisInput = services.diagnose.mock.calls[0]?.[0];

    expect(diagnosisInput).toMatchObject({
      apiKey: "test-api-key",
      model: "test-diagnosis-model",
    });
    expect(diagnosisInput?.context).toContain(
      "https://receiver.example.test/hooks/payments",
    );
    expect(diagnosisInput?.context).toContain("[REDACTED]");
    expect(diagnosisInput?.context).not.toContain("do-not-share");
    expect(diagnosisInput?.context).not.toContain("sk_live_request_secret");
    expect(diagnosisInput?.context).not.toContain("whsec_payload_secret");
  });
});
