// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMonthlyOnsCsv } from "@/worker/national-debt";

function latest(name: string) {
  const text = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
  const points = parseMonthlyOnsCsv(text);
  return points[points.length - 1];
}

describe("ONS generator debt files fetched 5 October 2026", () => {
  it("reads public sector net debt excluding banks as 2985.5 billion pounds in August 2026", () => {
    expect(latest("ons-hf6w.csv")).toMatchObject({ period: "2026 AUG", value: 2985.5 });
  });

  it("reads that debt as 93.8 percent of GDP in August 2026", () => {
    expect(latest("ons-hf6x.csv")).toMatchObject({ period: "2026 AUG", value: 93.8 });
  });
});
