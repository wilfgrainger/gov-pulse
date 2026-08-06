export const PUBLICATION_DIAGNOSTIC_CODES = Object.freeze({
  upstreamFetchFailure: "upstream_fetch_failure",
  parserContractRejection: "parser_contract_rejection",
  staleObservation: "stale_observation",
  missingHistory: "missing_history",
  snapshotDeliveryFailure: "snapshot_delivery_failure",
});

const summaries = Object.freeze({
  upstream_fetch_failure: "The official source could not be collected.",
  parser_contract_rejection:
    "The collected response did not satisfy the publication contract.",
  stale_observation:
    "The available observation is outside the section currentness rule.",
  missing_history:
    "The current observation lacks the comparable history required for publication.",
  snapshot_delivery_failure:
    "The published snapshot does not contain a usable section manifest.",
});
const allowedCodes = new Set(Object.values(PUBLICATION_DIAGNOSTIC_CODES));

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function failureCode(source, data, historyValid) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return PUBLICATION_DIAGNOSTIC_CODES.snapshotDeliveryFailure;
  }

  const status = text(source.status);
  const cacheState = text(source.cacheState);
  if (status === "ok" && cacheState === "fresh") {
    if (text(data?.__observation?.status) !== "current") {
      return PUBLICATION_DIAGNOSTIC_CODES.staleObservation;
    }
    return historyValid ? null : PUBLICATION_DIAGNOSTIC_CODES.missingHistory;
  }
  if (
    [status, cacheState].some((value) =>
      ["stale", "expired"].includes(value)
    )
  ) {
    return PUBLICATION_DIAGNOSTIC_CODES.staleObservation;
  }

  const error = text(source.error).toLowerCase();
  if (/history|comparison series|comparable series/.test(error)) {
    return PUBLICATION_DIAGNOSTIC_CODES.missingHistory;
  }
  if (/invalid json|parse|schema|contract|validation|malformed/.test(error)) {
    return PUBLICATION_DIAGNOSTIC_CODES.parserContractRejection;
  }
  if (/no current verified|not current|outside .*window|too old/.test(error)) {
    return PUBLICATION_DIAGNOSTIC_CODES.staleObservation;
  }
  if (status === "error" || cacheState === "missing") {
    return PUBLICATION_DIAGNOSTIC_CODES.upstreamFetchFailure;
  }
  return PUBLICATION_DIAGNOSTIC_CODES.snapshotDeliveryFailure;
}

export function classifyPublicationDiagnostic({
  section,
  source,
  data,
  historyValid = true,
}) {
  const code = failureCode(source, data, historyValid);
  if (!code) return null;
  return {
    section,
    code,
    summary: summaries[code],
    status: text(source?.status) || null,
    cacheState: text(source?.cacheState) || null,
    fetchedAt: text(source?.fetchedAt) || null,
  };
}

export function buildPublicationDiagnostics(
  snapshot,
  sectionIds,
  historyCheck = () => true
) {
  return Object.fromEntries(
    sectionIds.flatMap((section) => {
      const diagnostic = classifyPublicationDiagnostic({
        section,
        source: snapshot?.meta?.sources?.[section],
        data: snapshot?.[section],
        historyValid: historyCheck(section, snapshot?.[section]),
      });
      return diagnostic ? [[section, diagnostic]] : [];
    })
  );
}

export function validatePublicationDiagnostics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Publication diagnostics must be an object");
  }
  for (const [section, diagnostic] of Object.entries(value)) {
    if (
      !diagnostic ||
      typeof diagnostic !== "object" ||
      Array.isArray(diagnostic) ||
      diagnostic.section !== section ||
      !allowedCodes.has(diagnostic.code) ||
      typeof diagnostic.summary !== "string"
    ) {
      throw new Error(`Invalid publication diagnostic for ${section}`);
    }
  }
  return value;
}
