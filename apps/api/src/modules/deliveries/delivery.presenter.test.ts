import { describe, expect, it } from "vitest";
import { presentDelivery } from "./delivery.presenter.js";

describe("presentDelivery", () => {
  it("redacts credential-shaped values without removing operational context", () => {
    const presented = presentDelivery({
      targetUrl: "https://receiver.example.test/hooks/payments?token=leaked",
      requestHeaders: {
        authorization: "Bearer secret-token-value",
        "x-api-key": "api-key-value",
        "content-type": "application/json",
      },
      lastResponseBody: "signature=whsec_receiver_secret",
      event: {
        eventType: "payment.completed",
        payload: {
          paymentId: "pay_demo_001",
          signingSecret: "whsec_payload_secret",
          nested: {
            accessToken: "nested-token",
            note: "Bearer sk_live_example",
          },
        },
      },
      attempts: [
        {
          attemptNumber: 3,
          responseBody: "Authorization: Bearer sk_live_receiver_secret",
        },
      ],
    });

    expect(presented.targetUrl).toBe(
      "https://receiver.example.test/hooks/payments",
    );
    expect(presented.requestHeaders).toEqual({
      authorization: "[REDACTED]",
      "x-api-key": "[REDACTED]",
      "content-type": "application/json",
    });
    expect(presented.lastResponseBody).toBe("signature=[REDACTED]");
    expect(presented.event).toEqual({
      eventType: "payment.completed",
      payload: {
        paymentId: "pay_demo_001",
        signingSecret: "[REDACTED]",
        nested: {
          accessToken: "[REDACTED]",
          note: "Bearer [REDACTED]",
        },
      },
    });
    expect(presented.attempts).toEqual([
      {
        attemptNumber: 3,
        responseBody: "Authorization=[REDACTED]",
      },
    ]);
  });

  it("marks an invalid target URL instead of returning untrusted text", () => {
    expect(
      presentDelivery({
        targetUrl: "not a URL",
      }).targetUrl,
    ).toBe("[invalid URL]");
  });
});
