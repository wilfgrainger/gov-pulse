export type PublicMoneyValueBasis = "award-value" | "contract-value";

export function valueBasisDescription(valueBasis: PublicMoneyValueBasis): string {
  return valueBasis === "contract-value"
    ? "value in one uniquely linked contract"
    : "disclosed award value";
}

export type PublicAward = {
  rank: number; key: string; ocid: string; releaseId: string; awardId: string; title: string; buyer: string; buyerId?: string | null; suppliers: string[]; supplierIds?: Array<string | null>; supplierNations: string[];
  awardDate: string; publishedAt: string; amount: number; currency: "GBP"; valueBasis: PublicMoneyValueBasis; procurementMethod: string | null; procurementMethodDetails: string | null; mainProcurementCategory: string | null; framework: boolean; noticeUrl: string; procurementUrl: string;
};

export type AwardDossier = {
  id: string;
  identityBasis: "single-award-notice" | "exact-buyer-string" | "exact-supplier-string" | "publisher-buyer-id" | "publisher-supplier-id";
  kind: "notice" | "buyer" | "supplier";
  label: string;
  entityId: string | null;
  aliases: string[];
  award: PublicAward;
  awards: PublicAward[];
  disclosedTotal: number;
  noticeCount: number;
  filteredDenominator: number;
  noticeLinks: { releaseId: string; noticeUrl: string; procurementUrl: string; awardDate: string; amount: number; currency: "GBP" }[];
  caveats: string[];
};

export type DossierSelection = {
  kind: "notice" | "buyer" | "supplier";
  basis: "notice" | "publisher-id" | "exact-name";
  identity: string;
};

export type PublicMoneyUrlState = {
  query: string;
  buyer: string;
  nation: string;
  page: number;
  dossier: DossierSelection | null;
};

export type PublicMoneyExportContext = {
  windowLabel?: string;
  listedAwardSampleCount?: number;
  sourceWindowAwardCount?: number;
};

export function buildDossier(
  awards: PublicAward[],
  identity: string,
  kind: AwardDossier["kind"] = "notice",
  identityBasis: DossierSelection["basis"] = "exact-name",
): AwardDossier | null {
  const matches = (candidate: PublicAward) => {
    if (kind === "notice") return candidate.key === identity;
    if (kind === "buyer") return identityBasis === "publisher-id"
      ? candidate.buyerId === identity
      : candidate.buyer === identity;
    return identityBasis === "publisher-id"
      ? candidate.supplierIds?.includes(identity) === true
      : candidate.suppliers.includes(identity);
  };
  const award = awards.find(matches);
  if (!award) return null;
  const matchingAwards = kind === "notice" ? [award] : awards.filter(matches);
  const normalizedBasis: AwardDossier["identityBasis"] = kind === "notice"
    ? "single-award-notice"
    : identityBasis === "publisher-id"
      ? kind === "buyer" ? "publisher-buyer-id" : "publisher-supplier-id"
      : `exact-${kind}-string`;
  const label = kind === "notice"
    ? award.title
    : kind === "buyer"
      ? award.buyer
      : award.suppliers[award.supplierIds?.indexOf(identity) ?? -1] ?? identity;
  const aliases = kind === "notice" ? [] : [...new Set(matchingAwards.map((item) =>
    kind === "buyer" ? item.buyer : item.suppliers[item.supplierIds?.indexOf(identity) ?? -1] ?? identity,
  ))].sort((left, right) => left.localeCompare(right, "en-GB"));
  const entityId = kind === "notice" || identityBasis !== "publisher-id" ? null : identity;
  return {
    id: kind === "notice" ? award.key : `${kind}:${entityId ? `id:${entityId}` : `name:${identity}`}`,
    identityBasis: normalizedBasis,
    kind,
    label,
    entityId,
    aliases,
    award,
    awards: matchingAwards,
    disclosedTotal: matchingAwards.reduce((total, item) => total + item.amount, 0),
    noticeCount: matchingAwards.length,
    filteredDenominator: awards.length,
    noticeLinks: [...matchingAwards]
      .sort((left, right) => left.awardDate.localeCompare(right.awardDate) || left.releaseId.localeCompare(right.releaseId))
      .map((item) => ({
        releaseId: item.releaseId,
        noticeUrl: item.noticeUrl,
        procurementUrl: item.procurementUrl,
        awardDate: item.awardDate,
        amount: item.amount,
        currency: item.currency,
      })),
    caveats: [
      kind === "notice"
        ? "This dossier identifies one published award record, not a verified buyer or supplier legal entity."
        : identityBasis === "publisher-id"
          ? `These records share the exact Find a Tender ${kind} identifier ${identity}; the disclosed name may change across notices.`
          : `These records are grouped by the exact disclosed ${kind} string only; the name does not prove a shared legal entity and name collisions may combine unrelated parties.`,
      "The publisher window keeps its latest selected notice revision; it is not a complete release history.",
      ...(kind === "supplier" ? [`Matched ${valueBasisDescription(award.valueBasis)} amounts describe notices naming this supplier; they are not attributed supplier revenue. Multi-supplier notices are not allocated between suppliers.`] : []),
      `${valueBasisDescription(award.valueBasis)} is not an invoice or confirmed public expenditure; framework values may not be fully spent.`,
      `This record set contains ${matchingAwards.length} of ${awards.length} comparable GBP awards in the current filtered publication window.`,
    ],
  };
}

const EMPTY_PUBLIC_MONEY_STATE: PublicMoneyUrlState = {
  query: "",
  buyer: "all",
  nation: "all",
  page: 1,
  dossier: null,
};

export function parsePublicMoneyUrlState(search: string): PublicMoneyUrlState {
  const params = new URLSearchParams(String(search ?? "").replace(/^\?/, ""));
  const query = (params.get("q") ?? "").slice(0, 160);
  const buyer = (params.get("buyer") ?? "all").slice(0, 240) || "all";
  const nation = (params.get("nation") ?? "all").slice(0, 40) || "all";
  const rawPage = params.get("page") ?? "1";
  const parsedPage = /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(parsedPage) ? parsedPage : 1;
  const rawDossier = params.get("dossier");
  let dossier: DossierSelection | null = null;
  if (rawDossier) {
    const match = rawDossier.match(/^(notice|buyer|supplier):(notice|publisher-id|exact-name):(.+)$/);
    if (match && match[3].length <= 240 && !/[\u0000-\u001f\u007f]/.test(match[3])) {
      const kind = match[1] as DossierSelection["kind"];
      const basis = match[2] as DossierSelection["basis"];
      if ((kind === "notice" && basis === "notice") ||
          (kind !== "notice" && basis !== "notice")) {
        dossier = { kind, basis, identity: match[3] };
      }
    }
  }
  return { ...EMPTY_PUBLIC_MONEY_STATE, query, buyer, nation, page, dossier };
}

export function serializePublicMoneyUrlState(state: PublicMoneyUrlState): string {
  const params = new URLSearchParams();
  const query = state.query.trim().slice(0, 160);
  if (query) params.set("q", query);
  if (state.buyer !== "all") params.set("buyer", state.buyer);
  if (state.nation !== "all") params.set("nation", state.nation);
  if (Number.isSafeInteger(state.page) && state.page > 1) params.set("page", String(state.page));
  if (state.dossier?.identity && state.dossier.identity.length <= 240) {
    params.set("dossier", `${state.dossier.kind}:${state.dossier.basis}:${state.dossier.identity}`);
  }
  return params.toString();
}

export function filteredAwardCoverage(
  listedAwards: PublicAward[],
  visibleAwards: PublicAward[],
  completeWindowComparableAwardCount = listedAwards.length,
) {
  const sourceDenominator = Number.isSafeInteger(completeWindowComparableAwardCount) &&
    completeWindowComparableAwardCount >= listedAwards.length
    ? completeWindowComparableAwardCount
    : listedAwards.length;
  return {
    visibleCount: visibleAwards.length,
    listedCount: listedAwards.length,
    sourceDenominator,
    shareOfSourceWindow: sourceDenominator ? visibleAwards.length / sourceDenominator : 0,
  };
}

function csvCell(value: string | number | boolean | null): string {
  const raw = value === null ? "" : String(value);
  const text = typeof value === "string" && /^\s*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializePublicAwardsCsv(
  awards: PublicAward[],
  context: PublicMoneyExportContext = {},
): string {
  const columns = [
    "Notice ID", "Title", "Buyer", "Buyer ID", "Suppliers", "Supplier IDs", "Supplier nations", "Award date", "Publication date",
    "Recorded value", "Value basis", "Currency", "Procedure", "Framework", "Notice URL", "Procurement history URL",
    "Source window", "Filtered row count", "Published top-ranked sample count", "Full source-window award count", "Window coverage", "Currency basis note",
  ];
  const listedSampleCount = Number.isSafeInteger(context.listedAwardSampleCount) &&
    context.listedAwardSampleCount! >= awards.length
    ? context.listedAwardSampleCount!
    : awards.length;
  const sourceWindowAwardCount = Number.isSafeInteger(context.sourceWindowAwardCount) &&
    context.sourceWindowAwardCount! >= listedSampleCount
    ? context.sourceWindowAwardCount!
    : listedSampleCount;
  const windowCoverage = `${((sourceWindowAwardCount ? awards.length / sourceWindowAwardCount : 0) * 100).toFixed(1)}%`;
  const rows = awards.map((award) => [
    award.releaseId,
    award.title,
    award.buyer,
    award.buyerId ?? null,
    award.suppliers.join(", "),
    (award.supplierIds ?? []).filter((id): id is string => Boolean(id)).join(", ") || null,
    [...new Set(award.supplierNations)].join(", "),
    award.awardDate,
    award.publishedAt,
    award.amount,
    valueBasisDescription(award.valueBasis),
    award.currency,
    award.procurementMethodDetails ?? award.procurementMethod ?? "Not disclosed",
    award.framework,
    award.noticeUrl,
    award.procurementUrl,
    context.windowLabel?.trim() || "Not stated",
    awards.length,
    listedSampleCount,
    sourceWindowAwardCount,
    windowCoverage,
    `GBP only; ${valueBasisDescription(award.valueBasis)} is not confirmed expenditure`,
  ].map(csvCell));
  return [columns.map(csvCell).join(","), ...rows.map((row) => row.join(","))].join("\n");
}
