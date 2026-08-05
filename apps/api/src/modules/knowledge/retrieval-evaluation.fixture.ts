import type { KnowledgeCategory } from "./markdown-parser.js";

export type RetrievalEvaluationCase = {
  question: string;
  expectedDocumentIds: string[];
  eventType?: string;
  categories?: KnowledgeCategory[];
  expectNoResult?: boolean;
};

export const retrievalEvaluationCases: RetrievalEvaluationCase[] = [
  {
    question: "Why does signature verification fail after JSON parsing?",
    expectedDocumentIds: ["webhook-signatures", "invalid-signature"],
    eventType: "payment.completed",
    categories: ["documentation", "runbook"],
  },
  {
    question: "Which webhook secrets should a receiver accept during rotation?",
    expectedDocumentIds: ["secret-rotation"],
    eventType: "payment.completed",
    categories: ["documentation", "runbook"],
  },
  {
    question: "How should duplicate webhook events be handled safely?",
    expectedDocumentIds: ["idempotency-guide", "duplicate-event"],
    eventType: "subscription.cancelled",
    categories: ["documentation", "runbook"],
  },
  {
    question:
      "What should be checked after a receiver returns HTTP 504 timeout?",
    expectedDocumentIds: ["endpoint-timeout"],
    eventType: "subscription.cancelled",
    categories: ["runbook"],
  },
  {
    question: "Why can automatic webhook retries make an outage worse?",
    expectedDocumentIds: ["retry-storm-incident"],
    eventType: "subscription.cancelled",
    categories: ["postmortem", "runbook"],
  },
  {
    question: "What does the payment.completed event contain?",
    expectedDocumentIds: ["payment-completed"],
    eventType: "payment.completed",
    categories: ["documentation"],
  },
  {
    question: "How do I configure a mobile push-notification certificate?",
    expectedDocumentIds: [],
    categories: ["documentation", "runbook", "postmortem"],
    expectNoResult: true,
  },
];
