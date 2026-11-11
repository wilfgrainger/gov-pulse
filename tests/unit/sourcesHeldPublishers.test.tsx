import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import SourcesPage from "@/app/sources/page";

afterEach(cleanup);

// Uses the real config/publications.json: polling, betting markets, NHS waiting
// times and the country comparison are held, so their publishers are not current sources.
it("does not list a held publication's publishers as current sources", () => {
  render(<SourcesPage />);
  for (const name of ["YouGov British politics", "Oddschecker politics", "SIPRI Military Expenditure Database", "IMF DataMapper"]) {
    expect(screen.queryByRole("link", { name: new RegExp(name) })).toBeNull();
  }
  expect(screen.getAllByRole("link", { name: /Office for National Statistics/ }).length).toBeGreaterThan(0);
});
