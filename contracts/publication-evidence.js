const VOLATILE_PUBLICATION_KEYS = new Set([
  "checkedAt",
  "fetchedAt",
  "generatedAt",
  "retrievalTime",
  "retrievedAt",
  "reusedAt",
]);

function canonicalizePublication(value) {
  if (Array.isArray(value)) return value.map(canonicalizePublication);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !VOLATILE_PUBLICATION_KEYS.has(key))
      .sort((left, right) => left.localeCompare(right, "en-GB"))
      .map((key) => [key, canonicalizePublication(value[key])])
  );
}

function samePublicationEvidence(left, right) {
  return JSON.stringify(canonicalizePublication(left)) === JSON.stringify(canonicalizePublication(right));
}

export {
  VOLATILE_PUBLICATION_KEYS,
  canonicalizePublication,
  samePublicationEvidence,
};
