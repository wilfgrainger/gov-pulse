import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EvidenceSearch from "@/app/components/EvidenceSearch";

afterEach(() => cleanup());

describe("EvidenceSearch", () => {
  it("returns a direct supported route with evidence context", () => {
    render(<EvidenceSearch />);

    const input = screen.getByRole("searchbox", { name: /search UK public evidence/i });
    fireEvent.change(input, { target: { value: "NHS waiting list" } });

    const result = screen.getByRole("link", { name: /NHS waiting times/i });
    expect(result).toHaveAttribute("href", "/section/nhs");
    expect(screen.getByText("1 result")).toBeInTheDocument();
    expect(screen.getByText(/NHS England referral-to-treatment statistics/i)).toBeInTheDocument();
  });

  it("moves keyboard focus from the search box into results and back", () => {
    render(<EvidenceSearch />);

    const input = screen.getByRole("searchbox", { name: /search UK public evidence/i });
    fireEvent.change(input, { target: { value: "inflation" } });
    const result = screen.getByRole("link", { name: /Prices, rates and jobs/i });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(result).toHaveFocus();

    fireEvent.keyDown(result, { key: "ArrowUp" });
    expect(input).toHaveFocus();
  });

  it("fails closed for withdrawn evidence queries", () => {
    render(<EvidenceSearch />);

    fireEvent.change(screen.getByRole("searchbox", { name: /search UK public evidence/i }), {
      target: { value: "PM approval" },
    });

    expect(screen.getByText("0 results")).toBeInTheDocument();
    expect(screen.getByText(/No supported current evidence matches/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("notifies the navigation shell when a result is opened", () => {
    const onNavigate = vi.fn();
    render(<EvidenceSearch onNavigate={onNavigate} />);

    fireEvent.change(screen.getByRole("searchbox", { name: /search UK public evidence/i }), {
      target: { value: "GDP" },
    });
    fireEvent.click(screen.getByRole("link", { name: /GDP.*Open evidence/i }));

    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
