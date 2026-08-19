import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SectionNav from "@/app/components/SectionNav";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

vi.mock("@/app/components/EvidenceSearch", () => ({
  default: ({ onNavigate }: { onNavigate?: () => void }) => (
    <div>
      <span>Evidence search panel</span>
      <button type="button" onClick={onNavigate}>Open result</button>
    </div>
  ),
}));

const sections = [
  {
    category: "Economy",
    sections: [
      { id: "gdp", label: "GDP", shortLabel: "GDP" },
      { id: "employment", label: "Employment", shortLabel: "Jobs" },
    ],
  },
];

describe("SectionNav", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/section/gdp");
  });

  afterEach(() => {
    cleanup();
  });

  it("marks the current quick link for assistive technology", () => {
    render(<SectionNav sections={sections} />);

    const currentLinks = screen.getAllByRole("link", { name: "GDP" });
    expect(currentLinks).toHaveLength(1);
    expect(currentLinks[0]).toHaveAttribute("aria-current", "page");
  });

  it("provides a direct public-data.org home link", () => {
    render(<SectionNav sections={sections} />);

    expect(screen.getByRole("link", { name: "public-data.org" })).toHaveAttribute("href", "/");
  });

  it("opens the all-topics panel and returns focus after Escape", () => {
    render(<SectionNav sections={sections} />);

    const toggleButton = screen.getByRole("button", { name: "Topics" });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(toggleButton).toHaveAttribute("aria-controls", "all-topic-navigation");
    expect(screen.queryByRole("link", { name: "Employment" })).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Choose a public question." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Employment" })).toHaveAttribute("href", "/section/employment");
    expect(screen.getAllByRole("link", { name: "GDP" })).toHaveLength(2);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Employment" })).not.toBeInTheDocument();
    expect(toggleButton).toHaveFocus();
  });

  it("opens search and closes it after navigation", () => {
    render(<SectionNav sections={sections} />);

    const searchButton = screen.getByRole("button", { name: "Search evidence" });
    expect(searchButton).toHaveAttribute("aria-controls", "global-evidence-search-panel");
    expect(searchButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(searchButton);

    expect(searchButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Evidence search panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open result" }));
    expect(screen.queryByText("Evidence search panel")).not.toBeInTheDocument();
  });

  it("keeps the topics panel and global search mutually exclusive", () => {
    render(<SectionNav sections={sections} />);

    const topicButton = screen.getByRole("button", { name: "Topics" });
    const searchButton = screen.getByRole("button", { name: "Search evidence" });

    fireEvent.click(searchButton);
    expect(screen.getByText("Evidence search panel")).toBeInTheDocument();

    fireEvent.click(topicButton);
    expect(screen.queryByText("Evidence search panel")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Employment" })).toBeInTheDocument();

    fireEvent.click(searchButton);
    expect(screen.queryByRole("link", { name: "Employment" })).not.toBeInTheDocument();
    expect(screen.getByText("Evidence search panel")).toBeInTheDocument();
  });

  it("closes an open panel when clicking outside", () => {
    render(<SectionNav sections={sections} />);

    fireEvent.click(screen.getByRole("button", { name: "Topics" }));
    expect(screen.getByRole("link", { name: "Employment" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("link", { name: "Employment" })).not.toBeInTheDocument();
  });
});
