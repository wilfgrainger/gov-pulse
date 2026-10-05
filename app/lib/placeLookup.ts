/**
 * Look up a place against geographies the publication already carries.
 * No invented local-authority series. Postcodes never imply a nation.
 */

import { MEASURES, type MeasureDefinition } from "@/app/lib/measureDefinitions";

export type PlaceGeography = {
  label: string;
  code: string;
};

export type PlaceLookupMatch = {
  geography: PlaceGeography;
  measures: MeasureDefinition[];
  matchKind: "exact-label" | "exact-code" | "alias";
};

export type PlaceLookupResult =
  | { status: "empty-query" }
  | { status: "postcode-unclassified"; query: string; reason: string }
  | { status: "no-match"; query: string }
  | { status: "matched"; query: string; matches: PlaceLookupMatch[] };

const POSTCODE_AREA = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const POSTCODE_DISTRICT = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

const GEOGRAPHY_ALIASES: Record<string, string> = {
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "united kingdom": "United Kingdom",
  britain: "United Kingdom",
  "great britain": "Great Britain",
  gb: "Great Britain",
  england: "England",
  "england and wales": "England and Wales",
  scotland: "Scotland",
  wales: "Wales",
  "northern ireland": "Northern Ireland",
  ni: "Northern Ireland",
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function looksLikePostcode(query: string): boolean {
  const compact = query.trim().toUpperCase();
  return POSTCODE_AREA.test(compact) || POSTCODE_DISTRICT.test(compact);
}

function uniqueGeographies(): PlaceGeography[] {
  const byCode = new Map<string, PlaceGeography>();
  for (const measure of MEASURES) {
    if (!byCode.has(measure.geographyCode)) {
      byCode.set(measure.geographyCode, {
        label: measure.geography,
        code: measure.geographyCode,
      });
    }
  }
  return [...byCode.values()].sort((left, right) =>
    left.label.localeCompare(right.label, "en-GB"),
  );
}

function measuresForGeography(code: string): MeasureDefinition[] {
  return MEASURES.filter((measure) => measure.geographyCode === code).sort(
    (left, right) => left.label.localeCompare(right.label, "en-GB"),
  );
}

/**
 * Resolve a reader query to published geographies only.
 * Postcodes stay unclassified: a postcode area is not a country boundary.
 */
export function lookupPlace(rawQuery: string): PlaceLookupResult {
  const query = rawQuery.trim();
  if (!query) return { status: "empty-query" };

  if (looksLikePostcode(query)) {
    return {
      status: "postcode-unclassified",
      query,
      reason:
        "A postcode area is not a country boundary, and this publication does not invent local figures from a postcode. Border-straddling areas such as SY and TD, and Crown dependencies such as JE, stay unclassified.",
    };
  }

  const needle = normalize(query);
  const aliasLabel = GEOGRAPHY_ALIASES[needle];
  const matches: PlaceLookupMatch[] = [];

  for (const geography of uniqueGeographies()) {
    const label = normalize(geography.label);
    const code = normalize(geography.code);
    let matchKind: PlaceLookupMatch["matchKind"] | null = null;

    if (label === needle) matchKind = "exact-label";
    else if (code === needle) matchKind = "exact-code";
    else if (aliasLabel && normalize(aliasLabel) === label) matchKind = "alias";
    else if (label.includes(needle) && needle.length >= 3) matchKind = "alias";

    if (!matchKind) continue;
    matches.push({
      geography,
      measures: measuresForGeography(geography.code),
      matchKind,
    });
  }

  if (matches.length === 0) {
    return { status: "no-match", query };
  }

  return { status: "matched", query, matches };
}

export function publishedGeographies(): PlaceGeography[] {
  return uniqueGeographies();
}
