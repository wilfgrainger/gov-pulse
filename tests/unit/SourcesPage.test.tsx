import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SourcesPage, { SOURCE_GROUPS } from "@/app/sources/page";

vi.mock("@/app/components/DataAutomationSummary", () => ({
  default: () => <div>Automation summary</div>,
}));

afterEach(() => {
  cleanup();
});

describe("SourcesPage", () => {
  it("gives every source entry at least one secure direct publisher link", () => {
    const entries = SOURCE_GROUPS.flatMap((group) => group.entries);

    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      expect(entry.publishers.length, `${entry.name} must expose a publisher link`).toBeGreaterThan(0);

      for (const publisher of entry.publishers) {
        const url = new URL(publisher.url);
        expect(url.protocol, `${publisher.name} must use HTTPS`).toBe("https:");
        expect(url.hostname, `${publisher.name} must name a publisher host`).not.toBe("");
        expect(publisher.name.trim()).not.toBe("");
      }
    }
  });

  it("renders publisher links as clearly named external links", () => {
    render(<SourcesPage />);

    expect(screen.getByRole("heading", { name: /publisher directory/i })).toBeInTheDocument();

    const expectedPublishers = SOURCE_GROUPS.flatMap((group) => group.entries).flatMap((entry) => entry.publishers);
    const links = screen.getAllByRole("link", { name: /publisher website/i });
    const expectedByIdentity = new Map<string, { name: string; url: string; count: number }>();

    for (const publisher of expectedPublishers) {
      const key = `${publisher.name}\n${publisher.url}`;
      const existing = expectedByIdentity.get(key);
      expectedByIdentity.set(key, {
        name: publisher.name,
        url: publisher.url,
        count: (existing?.count ?? 0) + 1,
      });
    }

    expect(links).toHaveLength(expectedPublishers.length);

    for (const { name, url, count } of expectedByIdentity.values()) {
      const matchingLinks = screen.getAllByRole("link", {
        name: `Open ${name} publisher website`,
      });
      expect(matchingLinks).toHaveLength(count);
      for (const link of matchingLinks) {
        expect(link).toHaveAttribute("href", url);
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer");
      }
    }
  });

  it("describes the actual Cloudflare betting cadence and both production registers", () => {
    const betting = SOURCE_GROUPS.flatMap((group) => group.entries).find(
      (entry) => entry.name === "Oddschecker public politics markets"
    );

    expect(betting?.cadence).toBe("Checked every three hours; unavailable after four hours");

    const { container } = render(<SourcesPage />);
    expect(container.querySelector('[data-production-marker="current-publications"]')).not.toBeNull();
    expect(container.querySelector('[data-production-marker="evidence-gaps"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: /evidence must pass all three checks/i })).toBeInTheDocument();
  });

  it("lists regional and policy analysis only inside the evidence-gap group", () => {
    const gapGroup = SOURCE_GROUPS.find((group) => group.category.startsWith("Evidence gaps"));
    const currentGroups = SOURCE_GROUPS.filter((group) => !group.category.startsWith("Evidence gaps"));
    const currentNames = currentGroups.flatMap((group) => group.entries).map((entry) => entry.name);

    expect(gapGroup?.entries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["UK regional comparison", "Policy relationship analysis"])
    );
    expect(currentNames).not.toContain("UK regional comparison");
    expect(currentNames).not.toContain("Policy relationship analysis");

    render(<SourcesPage />);
    expect(screen.getByText(/No map, ranking or value is displayed/i)).toBeInTheDocument();
    expect(screen.getByText(/No coefficient or relationship strength is displayed/i)).toBeInTheDocument();
  });
});
