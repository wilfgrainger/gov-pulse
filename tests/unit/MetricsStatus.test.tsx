import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MetricsStatus from "@/app/components/MetricsStatus";

afterEach(() => {
  cleanup();
});

describe("MetricsStatus", () => {
  it("puts current period, primary sources and caveat in a compact footer", () => {
    render(
      <MetricsStatus
        section="sentimentPulse"
        status={{
          isLive: true,
          lastUpdated: new Date("2026-07-12T12:00:00Z"),
          cacheState: "fresh",
          observationPeriod: "Series-specific periods shown below",
          observationStatus: "current",
        }}
      />
    );

    expect(screen.getByText("Latest available")).toBeInTheDocument();
    expect(screen.getByText("Official data")).toBeInTheDocument();
    expect(screen.getByText("May be revised")).toBeInTheDocument();
    expect(
      screen.getByText(/period series-specific periods shown below/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/checked 12 jul 2026, 12:00 utc/i)).toBeInTheDocument();
    expect(screen.getByText("Sources:")).toBeInTheDocument();
    expect(screen.getByText("What to know:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all sources/i })).toHaveAttribute(
      "href",
      "/sources"
    );
    expect(
      screen.getByRole("link", { name: /open ons cpi d7g7 source website/i })
    ).toHaveAttribute(
      "href",
      "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23"
    );
    expect(
      screen.getByRole("link", {
        name: /open bank of england bank rate iudbedr source website/i,
      })
    ).toHaveAttribute(
      "href",
      "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp"
    );
    expect(
      screen.getByRole("link", { name: /open ons unemployment mgsx source website/i })
    ).toHaveAttribute(
      "href",
      "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms"
    );
    expect(screen.queryByText(/how this evidence was produced/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Expected update window")).not.toBeInTheDocument();
    expect(screen.queryByText("Publication cadence")).not.toBeInTheDocument();
    expect(screen.queryByText("Update method")).not.toBeInTheDocument();
  });

  it("describes withdrawn public-opinion evidence without implying a current source", () => {
    render(
      <MetricsStatus
        section="pmApproval"
        status={{
          isLive: false,
          lastUpdated: null,
          cacheState: null,
          observationPeriod: null,
          observationStatus: null,
        }}
      />
    );

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Public opinion")).toBeInTheDocument();
    expect(screen.getByText("No current evidence is displayed")).toBeInTheDocument();
    expect(screen.getByText("No current verified source")).toBeInTheDocument();
    expect(
      screen.getByText(/will not infer or average a current PM approval number/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /open yougov source website/i })
    ).not.toBeInTheDocument();
  });

  it("labels betting odds as a market signal without exposing the freshness policy", () => {
    render(
      <MetricsStatus
        section="bettingOdds"
        status={{
          isLive: true,
          lastUpdated: new Date("2026-07-12T12:00:00Z"),
          cacheState: "fresh",
          observationPeriod: null,
          observationStatus: null,
        }}
      />
    );

    expect(screen.getByText("Market signal")).toBeInTheDocument();
    expect(screen.getByText("Date unverified")).toBeInTheDocument();
    expect(
      screen.getByText(/neither official statistics nor official forecasts/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("Within 4 hours of market observation")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /open oddschecker public politics markets source website/i,
      })
    ).toHaveAttribute("href", "https://www.oddschecker.com/politics");
  });

  it("does not imply freshness when fallback data is displayed", () => {
    render(
      <MetricsStatus
        section="sentimentPulse"
        status={{
          isLive: false,
          lastUpdated: null,
          cacheState: null,
          observationPeriod: null,
          observationStatus: null,
        }}
      />
    );

    expect(screen.getByText("Current value unavailable")).toBeInTheDocument();
    expect(screen.getByText("No current verified value")).toBeInTheDocument();
    expect(screen.queryByText("Check time unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText("Expected update window")).not.toBeInTheDocument();
  });

  it("warns when an automated feed is unavailable without explaining pipeline internals", () => {
    render(
      <MetricsStatus
        section="sentimentPulse"
        status={{
          isLive: true,
          lastUpdated: new Date("2026-03-17T12:00:00Z"),
          cacheState: "expired",
          observationPeriod: null,
          observationStatus: null,
        }}
      />
    );

    expect(screen.getByText("Update unavailable")).toBeInTheDocument();
    expect(screen.getByText(/keeps their observation periods/i)).toBeInTheDocument();
    expect(screen.queryByText(/acceptable update window/i)).not.toBeInTheDocument();
  });

  it("keeps user-generated sources as plain text when no publisher exists", () => {
    render(
      <MetricsStatus
        section="politicalCompass"
        status={{
          isLive: false,
          lastUpdated: null,
          cacheState: null,
          observationPeriod: null,
          observationStatus: null,
        }}
      />
    );

    expect(screen.getByText("Calculated here")).toBeInTheDocument();
    expect(screen.getByText("User responses")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /user responses/i })).not.toBeInTheDocument();
  });
});
