import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDelivery, getDeliveryDiagnosis, requestRetry } from "../lib/api";
import { diagnosis, failedDeliveryDetail, queuedRetry } from "../test/fixtures";
import { renderWithQueryClient } from "../test/test-utils";
import { DeliveryDetailView } from "./delivery-detail-view";

vi.mock("next/navigation", () => ({
  useParams: vi.fn(() => ({ deliveryId: "delivery-401" })),
}));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();

  return {
    ...actual,
    getDelivery: vi.fn(),
    getDeliveryDiagnosis: vi.fn(),
    requestRetry: vi.fn(),
  };
});

const getDeliveryMock = vi.mocked(getDelivery);
const getDeliveryDiagnosisMock = vi.mocked(getDeliveryDiagnosis);
const requestRetryMock = vi.mocked(requestRetry);

describe("DeliveryDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDeliveryMock.mockResolvedValue({ data: failedDeliveryDetail });
  });

  it("renders diagnosis evidence and retrieval sources after a diagnosis request", async () => {
    getDeliveryDiagnosisMock.mockResolvedValue({ data: diagnosis });
    const user = userEvent.setup();

    renderWithQueryClient(<DeliveryDetailView />);

    await screen.findByText("Request and receiver response");
    await user.click(screen.getByRole("button", { name: "Diagnose failure" }));

    expect(
      await screen.findByText(
        "The receiver rejected the webhook because the HMAC signature is invalid.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Webhook Signature Guide")).toBeInTheDocument();
    expect(screen.getByText("Raw payload verification")).toBeInTheDocument();
    expect(getDeliveryDiagnosisMock).toHaveBeenCalledWith("delivery-401");
  });

  it("requires confirmation before it queues a retry", async () => {
    requestRetryMock.mockResolvedValue({ data: queuedRetry });
    const user = userEvent.setup();

    renderWithQueryClient(<DeliveryDetailView />);

    await screen.findByText("Safe retry");
    const retryButton = screen.getByRole("button", { name: "Queue retry" });

    expect(retryButton).toBeDisabled();

    await user.click(
      screen.getByLabelText(
        "I confirmed with the user that this failed delivery should be queued for retry.",
      ),
    );
    expect(retryButton).toBeEnabled();

    await user.click(retryButton);

    expect(
      await screen.findByText("Retry queued. Attempt 2 is now pending."),
    ).toBeInTheDocument();
    expect(requestRetryMock).toHaveBeenCalledWith(
      "delivery-401",
      expect.any(String),
    );
  });
});
