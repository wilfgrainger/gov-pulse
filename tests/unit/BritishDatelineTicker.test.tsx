import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BritishDatelineTicker from "@/app/components/visuals/BritishDatelineTicker";
import { MetricsSnapshotProvider } from "@/app/lib/MetricsSnapshotProvider";

describe("BritishDatelineTicker", () => {
  it("shows a source-backed publication date instead of fixed national figures", () => {
    const snapshot = {
      meta: {
        registryVersion: "test",
        sources: {},
        editionSummary: {
          id: "edition-2026-10-02",
          publishedAt: "2026-10-02T09:30:00.000Z",
          sourceEditionIds: [],
          changes: [],
        },
      },
    };

    render(
      <MetricsSnapshotProvider snapshot={snapshot as never}>
        <BritishDatelineTicker />
      </MetricsSnapshotProvider>,
    );

    expect(screen.getByRole("time")).toHaveAttribute(
      "dateTime",
      "2026-10-02T09:30:00.000Z",
    );
    expect(
      screen.getByRole("link", { name: /Latest evidence edition.*2 Oct 2026/ }),
    ).toBeInTheDocument();
    const strip = screen.getByLabelText("Latest public evidence edition");
    expect(strip).not.toHaveTextContent(/£13\.15B|3\.4%|5\.25%|7\.57M|LIVE UK EVIDENCE/);
  });

  it("states when the publication date is missing", () => {
    render(
      <MetricsSnapshotProvider snapshot={null}>
        <BritishDatelineTicker />
      </MetricsSnapshotProvider>,
    );

    expect(screen.getByText("Publication dates appear with each figure")).toBeInTheDocument();
  });
});
