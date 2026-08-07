import { describe, expect, it } from "vitest";
import {
  getRetryRejectionReason,
  MAX_RETRY_COUNT,
  resolveRetryActorRole,
  retryRejectionStatus,
} from "./retry.service.js";

describe("resolveRetryActorRole", () => {
  it("recognizes an operator header case-insensitively", () => {
    expect(resolveRetryActorRole("OPERATOR")).toBe("operator");
    expect(resolveRetryActorRole(["operator", "viewer"])).toBe("operator");
  });

  it("defaults missing and unsupported roles to viewer", () => {
    expect(resolveRetryActorRole(undefined)).toBe("viewer");
    expect(resolveRetryActorRole("admin")).toBe("viewer");
  });
});

describe("getRetryRejectionReason", () => {
  it.each([
    {
      name: "a missing delivery",
      input: {
        delivery: null,
        actorRole: "viewer" as const,
        confirmed: false,
      },
      expected: "DELIVERY_NOT_FOUND",
    },
    {
      name: "a viewer request",
      input: {
        delivery: { status: "failed", retryCount: 0 },
        actorRole: "viewer" as const,
        confirmed: true,
      },
      expected: "FORBIDDEN",
    },
    {
      name: "an unconfirmed request",
      input: {
        delivery: { status: "failed", retryCount: 0 },
        actorRole: "operator" as const,
        confirmed: false,
      },
      expected: "CONFIRMATION_REQUIRED",
    },
    {
      name: "a non-failed delivery",
      input: {
        delivery: { status: "pending", retryCount: 0 },
        actorRole: "operator" as const,
        confirmed: true,
      },
      expected: "DELIVERY_NOT_FAILED",
    },
    {
      name: "a delivery at the retry limit",
      input: {
        delivery: { status: "failed", retryCount: MAX_RETRY_COUNT },
        actorRole: "operator" as const,
        confirmed: true,
      },
      expected: "RETRY_LIMIT_REACHED",
    },
  ])("rejects $name", ({ input, expected }) => {
    expect(getRetryRejectionReason(input)).toBe(expected);
  });

  it("allows a confirmed operator retry below the limit", () => {
    expect(
      getRetryRejectionReason({
        delivery: { status: "failed", retryCount: MAX_RETRY_COUNT - 1 },
        actorRole: "operator",
        confirmed: true,
      }),
    ).toBeNull();
  });
});

describe("retryRejectionStatus", () => {
  it("maps rejection reasons to stable HTTP statuses", () => {
    expect(retryRejectionStatus("DELIVERY_NOT_FOUND")).toBe(404);
    expect(retryRejectionStatus("FORBIDDEN")).toBe(403);
    expect(retryRejectionStatus("CONFIRMATION_REQUIRED")).toBe(400);
    expect(retryRejectionStatus("DELIVERY_NOT_FAILED")).toBe(409);
    expect(retryRejectionStatus("RETRY_LIMIT_REACHED")).toBe(409);
  });
});
