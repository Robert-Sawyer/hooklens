import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDeliveries } from "../lib/api";
import { deliveriesResponse } from "../test/fixtures";
import { renderWithQueryClient } from "../test/test-utils";
import { DeliveriesView } from "./deliveries-view";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();

  return {
    ...actual,
    getDeliveries: vi.fn(),
  };
});

const getDeliveriesMock = vi.mocked(getDeliveries);

describe("DeliveriesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the delivery request is pending", () => {
    getDeliveriesMock.mockImplementation(() => new Promise(() => undefined));

    renderWithQueryClient(<DeliveriesView />);

    expect(screen.getByText(/Loading records/)).toBeInTheDocument();
  });

  it("shows the request error returned by the API", async () => {
    getDeliveriesMock.mockRejectedValue(new Error("API is unavailable"));

    renderWithQueryClient(<DeliveriesView />);

    expect(await screen.findByText("API is unavailable")).toBeInTheDocument();
  });

  it("applies status and event-type filters before requesting deliveries", async () => {
    getDeliveriesMock.mockResolvedValue(deliveriesResponse);
    const user = userEvent.setup();

    renderWithQueryClient(<DeliveriesView />);

    expect(await screen.findByText("payment.completed")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Status"), "failed");
    await user.type(
      screen.getByPlaceholderText("payment.completed"),
      "payment.completed",
    );
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(getDeliveriesMock).toHaveBeenLastCalledWith({
        page: 1,
        status: "failed",
        eventType: "payment.completed",
      });
    });
  });
});
