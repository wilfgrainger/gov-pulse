import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicationOffline from "@/app/components/PublicationOffline";

vi.mock("@/config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{
    default: { publications: Record<string, { enabled: boolean; sections?: string[] }> };
  }>();

  return {
    default: {
      ...config,
      publications: Object.fromEntries(
        Object.entries(config.publications).map(([id, entry]) => [
          id,
          { ...entry, enabled: false },
        ]),
      ),
    },
  };
});

afterEach(cleanup);

describe("PublicationOffline publication policy", () => {
  it("does not advertise evidence routes that are disabled with the publication", () => {
    render(<PublicationOffline />);

    expect(screen.getByRole("link", { name: "Latest" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Explore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Compare" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Briefing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sources" })).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editorial policy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact" })).toBeInTheDocument();
  });
});
