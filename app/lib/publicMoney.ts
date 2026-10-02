export type PublicAward = {
  rank: number; key: string; ocid: string; releaseId: string; awardId: string; title: string; buyer: string; suppliers: string[]; supplierNations: string[];
  awardDate: string; publishedAt: string; amount: number; currency: "GBP"; procurementMethod: string | null; procurementMethodDetails: string | null; mainProcurementCategory: string | null; framework: boolean; noticeUrl: string; procurementUrl: string;
};

export type AwardDossier = {
  id: string;
  identityBasis: "single-award-notice" | "exact-buyer-string" | "exact-supplier-string";
  kind: "notice" | "buyer" | "supplier";
  label: string;
  award: PublicAward;
  awards: PublicAward[];
  disclosedTotal: number;
  noticeCount: number;
  filteredDenominator: number;
  noticeLinks: { releaseId: string; noticeUrl: string; procurementUrl: string }[];
  caveats: string[];
};

export function buildDossier(awards: PublicAward[], identity: string, kind: AwardDossier["kind"] = "notice"): AwardDossier | null {
  const award = kind === "notice"
    ? awards.find((candidate) => candidate.key === identity)
    : awards.find((candidate) => kind === "buyer" ? candidate.buyer === identity : candidate.suppliers.includes(identity));
  if (!award) return null;
  const matchingAwards = kind === "notice"
    ? [award]
    : awards.filter((candidate) => kind === "buyer" ? candidate.buyer === identity : candidate.suppliers.includes(identity));
  const identityBasis = kind === "notice" ? "single-award-notice" : `exact-${kind}-string` as const;
  const label = kind === "notice" ? award.title : identity;
  return {
    id: kind === "notice" ? award.key : `${kind}:${identity}`,
    identityBasis,
    kind,
    label,
    award,
    awards: matchingAwards,
    disclosedTotal: matchingAwards.reduce((total, item) => total + item.amount, 0),
    noticeCount: matchingAwards.length,
    filteredDenominator: awards.length,
    noticeLinks: matchingAwards.map((item) => ({ releaseId: item.releaseId, noticeUrl: item.noticeUrl, procurementUrl: item.procurementUrl })),
    caveats: [
      kind === "notice"
        ? "This dossier identifies one published award record, not a verified buyer or supplier legal entity."
        : `These records are grouped by the exact disclosed ${kind} string only; the name does not prove a shared legal entity and name collisions may combine unrelated parties.`,
      "The publisher window keeps its latest selected notice revision; it is not a complete release history.",
      ...(kind === "supplier" ? ["Each matched notice contributes its full disclosed award value; multi-supplier awards are not allocated between suppliers."] : []),
      "Disclosed award value is not an invoice or confirmed public expenditure; framework values may not be fully spent.",
      `This record set contains ${matchingAwards.length} of ${awards.length} comparable GBP awards in the current filtered publication window.`,
    ],
  };
}

export function filteredAwardCoverage(allAwards: PublicAward[], visibleAwards: PublicAward[]) {
  return {
    visibleCount: visibleAwards.length,
    sourceDenominator: allAwards.length,
    shareOfSourceWindow: allAwards.length ? visibleAwards.length / allAwards.length : 0,
  };
}

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializePublicAwardsCsv(awards: PublicAward[]): string {
  const columns = [
    "Notice ID", "Title", "Buyer", "Suppliers", "Supplier nations", "Award date", "Publication date",
    "Disclosed award value", "Currency", "Procedure", "Framework", "Notice URL", "Procurement history URL",
  ];
  const rows = awards.map((award) => [
    award.releaseId,
    award.title,
    award.buyer,
    award.suppliers.join(", "),
    [...new Set(award.supplierNations)].join(", "),
    award.awardDate,
    award.publishedAt,
    award.amount,
    award.currency,
    award.procurementMethodDetails ?? award.procurementMethod ?? "Not disclosed",
    award.framework,
    award.noticeUrl,
    award.procurementUrl,
  ].map(csvCell));
  return [columns.map(csvCell).join(","), ...rows.map((row) => row.join(","))].join("\n");
}
