import { describe, expect, it } from "vitest";
import { filterPollingPublications, pollingLabOptions } from "@/app/lib/pollingLab";

const publications = [
  { id: "yougov-a", pollster: "YouGov", fieldworkStart: "2026-09-01", fieldworkEnd: "2026-09-03" },
  { id: "yougov-b", pollster: "YouGov", fieldworkStart: "2026-09-08", fieldworkEnd: "2026-09-10" },
  { id: "ipsos-a", pollster: "Ipsos", fieldworkStart: "2026-09-09", fieldworkEnd: "2026-09-11" },
];

describe("polling lab publication filters", () => {
  it("keeps publisher publications separate and filters on overlapping fieldwork dates", () => {
    const selected = filterPollingPublications(publications, { pollster: "all", from: "2026-09-10", to: "2026-09-10" });
    expect(selected.map(({ id }) => id)).toEqual(["yougov-b", "ipsos-a"]);
  });

  it("filters by the publisher identity without deriving an average", () => {
    const selected = filterPollingPublications(publications, { pollster: "YouGov", from: "", to: "" });
    expect(selected.map(({ id }) => id)).toEqual(["yougov-a", "yougov-b"]);
    expect(pollingLabOptions(publications)).toEqual(["Ipsos", "YouGov"]);
  });

  it("does not broaden an inverted date window into results", () => {
    expect(filterPollingPublications(publications, { pollster: "all", from: "2026-09-20", to: "2026-09-01" })).toEqual([]);
  });
});
