import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MetricsStatus from "@/app/components/MetricsStatus";

afterEach(cleanup);

describe("MetricsStatus", () => {
  it("keeps currentness visible and places source detail behind an accessible disclosure", () => {
    render(
      <MetricsStatus
        section="electionPolling"
        status={{
          isLive: false,
          lastUpdated: null,
          cacheState: "missing",
          observationPeriod: null,
          observationStatus: "unavailable",
        }}
      />
    );

    expect(screen.getByText("Current value unavailable")).toBeInTheDocument();
    expect(screen.getByText("No current verified value")).toBeInTheDocument();
    const methods = screen.getByText("Sources and methods");
    expect(methods.tagName).toBe("SUMMARY");

    fireEvent.click(methods);

    expect(
      screen.getByRole("link", {
        name: "Open Verified primary pollster publications source website",
      })
    ).toHaveAttribute("href", "https://yougov.com/en-gb/topics/topic/British_Politics");
    expect(screen.getByText(/One poll is not evidence of a durable trend/i)).toBeInTheDocument();
  });

  it("lets a route-specific unavailable state own currentness without duplicating it", () => {
    render(
      <MetricsStatus
        section="electionPolling"
        showCurrentness={false}
        status={{
          isLive: false,
          lastUpdated: null,
          cacheState: "missing",
          observationPeriod: null,
          observationStatus: "unavailable",
        }}
      />
    );

    expect(screen.queryByText("Current value unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText("No current verified value")).not.toBeInTheDocument();
    expect(screen.getByText("Sources and methods")).toBeInTheDocument();
  });
});
