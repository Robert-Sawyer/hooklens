const deliveryId = "20000000-0000-4000-8000-000000000001";

const diagnosis = {
  data: {
    kind: "diagnosed",
    deliveryId,
    eventType: "payment.completed",
    status: "failed",
    httpStatus: 401,
    diagnosis:
      "The receiver rejected the webhook because the HMAC signature is invalid.",
    retrievalQuery: "payment.completed 401 Invalid signature",
    sources: [
      {
        documentId: "webhook-signatures",
        title: "Webhook Signature Guide",
        section: "Raw payload verification",
        category: "documentation",
      },
      {
        documentId: "invalid-signature-runbook",
        title: "Invalid Signature Runbook",
        section: "Check the active secret",
        category: "runbook",
      },
    ],
  },
};

describe("failed webhook investigation", () => {
  beforeEach(() => {
    cy.intercept(
      "POST",
      `/api/v1/deliveries/${deliveryId}/diagnosis`,
      diagnosis,
    ).as("diagnoseDelivery");
  });

  it("investigates a seeded invalid signature and queues a retry only after confirmation", () => {
    cy.visit("/deliveries");

    cy.contains("tr", "payment.completed")
      .should("contain.text", "401")
      .and("contain.text", "Retries: 2/3")
      .within(() => {
        cy.contains("a", "Inspect").click();
      });

    cy.url().should("include", `/deliveries/${deliveryId}`);
    cy.contains("h1", "payment.completed").should("be.visible");
    cy.contains("Invalid signature").should("be.visible");

    cy.contains("h2", "AI diagnosis")
      .closest("section")
      .within(() => {
        cy.contains("button", "Diagnose failure").click();
      });

    cy.wait("@diagnoseDelivery");
    cy.contains(
      "The receiver rejected the webhook because the HMAC signature is invalid.",
    ).should("be.visible");
    cy.contains("Webhook Signature Guide").should("be.visible");
    cy.contains("Raw payload verification").should("be.visible");

    cy.contains("h2", "Safe retry")
      .closest("section")
      .within(() => {
        cy.contains("button", "Queue retry").should("be.disabled");
        cy.get('input[type="checkbox"]').check();
        cy.contains("button", "Queue retry").should("be.enabled").click();
        cy.contains("Retry queued. Attempt 4 is now pending.").should(
          "be.visible",
        );
      });

    cy.contains("h2", "Retry audit")
      .closest("section")
      .should("contain.text", "Attempt 4 queued by operator.");
  });
});
