import { connection } from "next/server";
import { cache } from "react";
import {
  isInternationalComparisonPublication,
  type InternationalComparisonPublication,
} from "./internationalComparison";

const PRODUCTION_COMPARISON_URL =
  "https://public-data.org/data/international-comparison.json";

export const readServerInternationalComparison = cache(
  async (): Promise<InternationalComparisonPublication | null> => {
    if (process.env.STATIC_EXPORT === "true") return null;

    await connection();
    if (process.env.NODE_ENV !== "production") return null;

    try {
      const response = await fetch(PRODUCTION_COMPARISON_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return null;
      const payload: unknown = await response.json();
      return isInternationalComparisonPublication(payload) ? payload : null;
    } catch {
      return null;
    }
  }
);
