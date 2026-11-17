import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GovDataDirectory, { filterDirectory } from "@/app/components/GovDataDirectory";
import { DIRECTORY_ENTRY_COUNT, GOV_DATA_DIRECTORY } from "@/app/lib/govDataDirectory";

afterEach(() => cleanup());

const entries = GOV_DATA_DIRECTORY.flatMap((category) => category.entries);

describe("government data directory contents", () => {
  it("links only to HTTPS publisher URLs with unique ids and URLs", () => {
    expect(entries.length).toBe(DIRECTORY_ENTRY_COUNT);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
    for (const entry of entries) {
      const url = new URL(entry.url);
      expect(url.protocol, entry.id).toBe("https:");
      expect(url.username + url.password + url.search + url.hash, entry.id).toBe("");
      expect(entry.access.length, entry.id).toBeGreaterThan(0);
      expect(entry.description.trim().length, entry.id).toBeGreaterThan(10);
    }
  });

  it("keeps independent tools explicitly labelled and in the minority", () => {
    const independent = entries.filter((e) => e.owner === "independent");
    expect(independent.length).toBeLessThan(entries.length / 10);
    for (const entry of independent) expect(new URL(entry.url).hostname).not.toMatch(/\.(gov\.uk|gov\.scot|gov\.wales|parliament\.uk|nhs\.uk)$/);
  });

  it("covers every nation and the right to request unpublished data", () => {
    for (const nation of ["Scotland", "Wales", "Northern Ireland"]) {
      expect(entries.some((e) => e.coverage === nation), nation).toBe(true);
    }
    expect(entries.some((e) => e.access.includes("Request"))).toBe(true);
  });
});

describe("filterDirectory", () => {
  it("matches every search term across name, publisher and description", () => {
    const ids = filterDirectory(GOV_DATA_DIRECTORY, "house prices", "All").flatMap((c) => c.entries.map((e) => e.id));
    expect(ids).toContain("ukhpi");
    expect(ids).not.toContain("hansard");
  });

  it("treats UK-wide services as covering each nation and GB as excluding Northern Ireland", () => {
    const ni = filterDirectory(GOV_DATA_DIRECTORY, "", "Northern Ireland").flatMap((c) => c.entries);
    expect(ni.every((e) => e.coverage === "UK" || e.coverage === "Northern Ireland")).toBe(true);
    expect(ni.some((e) => e.id === "nisra")).toBe(true);
    expect(ni.some((e) => e.id === "stat-xplore")).toBe(false);

    const scotland = filterDirectory(GOV_DATA_DIRECTORY, "", "Scotland").flatMap((c) => c.entries.map((e) => e.id));
    expect(scotland).toContain("stat-xplore");
    expect(scotland).not.toContain("explore-education-statistics");
  });
});

describe("GovDataDirectory", () => {
  it("renders every entry without interaction, then narrows by search and nation", () => {
    const { container } = render(<GovDataDirectory categories={GOV_DATA_DIRECTORY} />);
    expect(container.querySelectorAll("[data-directory-entry]").length).toBe(DIRECTORY_ENTRY_COUNT);
    expect(screen.getByRole("link", { name: /data\.gov\.uk/ })).toHaveAttribute("href", "https://www.data.gov.uk/");

    fireEvent.change(screen.getByLabelText("Search the directory"), { target: { value: "schools" } });
    const status = screen.getByRole("status");
    expect(container.querySelectorAll("[data-directory-entry]").length).toBeLessThan(DIRECTORY_ENTRY_COUNT);
    expect(within(container).getByRole("link", { name: /Get information about schools/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Scotland" }));
    expect(screen.getByRole("button", { name: "Scotland" })).toHaveAttribute("aria-pressed", "true");
    expect(within(container).queryByRole("link", { name: /Get information about schools/ })).not.toBeInTheDocument();
    expect(status.textContent).toMatch(/covering Scotland/);
  });

  it("shows a useful empty state instead of a blank page", () => {
    render(<GovDataDirectory categories={GOV_DATA_DIRECTORY} />);
    fireEvent.change(screen.getByLabelText("Search the directory"), { target: { value: "zzzz-no-such-service" } });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });
});
