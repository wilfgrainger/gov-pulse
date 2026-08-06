import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const currentTime = () => new Date().toISOString();

describe("DataAutomationSummary", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("renders current publication status, evidence class and geographic coverage together", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const now = currentTime();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          meta: {
            registryVersion: "2026-08-02.1",
            generatedAt: now,
            sources: {
              sentimentPulse: {
                status: "ok",
                fetchedAt: now,
                cacheState: "fresh",
              },
            },
          },
          sentimentPulse: {
            __observation: {
              status: "current",
              observedAt: now,
              maxAgeDays: 40,
            },
          },
        }),
      })
    );

    const { default: DataAutomationSummary } = await import(
      "@/app/components/DataAutomationSummary"
    );

    render(<DataAutomationSummary />);

    await waitFor(() => {
      expect(screen.getByText("Current")).toBeInTheDocument();
    });

    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.queryByText(/snapshot/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Interactive").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Official data").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Public opinion").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Market signal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("United Kingdom").length).toBeGreaterThan(0);
    for (const sectionName of [
      "PM Approval",
      "Polarization Measure",
      "Government Satisfaction Trend",
      "UK Regional Comparison",
      "Policy Relationship Matrix",
    ]) {
      expect(screen.queryByText(sectionName)).not.toBeInTheDocument();
    }

    expect(screen.getByText(/publication check, not an endorsement/i)).toBeInTheDocument();
    expect(screen.queryByText("sentimentPulse")).not.toBeInTheDocument();
    expect(screen.queryByText(/cache|worker|github pages/i)).not.toBeInTheDocument();
  });

  it("renders malformed snapshot timestamps as unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          meta: {
            registryVersion: "2026-08-02.1",
            generatedAt: "not-a-date",
            sources: {
              sentimentPulse: {
                status: "ok",
                fetchedAt: "also-not-a-date",
                cacheState: "fresh",
              },
            },
          },
        }),
      })
    );

    const { default: DataAutomationSummary } = await import(
      "@/app/components/DataAutomationSummary"
    );

    render(<DataAutomationSummary />);

    await waitFor(() => {
      expect(
        screen.getAllByText("Temporarily unavailable").length
      ).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("Not available").length).toBeGreaterThanOrEqual(2);
  });
});