import { createHash } from "node:crypto";

const VOLATILE_KEYS = new Set([
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
      .filter((key) => !VOLATILE_KEYS.has(key))
      .sort((left, right) => left.localeCompare(right, "en-GB"))
      .map((key) => [key, canonicalizePublication(value[key])])
  );
}

function publicationFingerprint(snapshot, revision) {
  const payload = {
    revision,
    snapshot: canonicalizePublication(snapshot),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function publicationDecision({
  eventName,
  deployedRevisionMatches,
  previousSnapshotValid,
  candidateFingerprint,
  previousFingerprint,
}) {
  if (eventName !== "schedule") {
    return { deploy: true, reason: "non-scheduled runs always deploy" };
  }
  if (!deployedRevisionMatches) {
    return { deploy: true, reason: "production does not serve the current revision" };
  }
  if (!previousSnapshotValid) {
    return { deploy: true, reason: "the published snapshot is no longer safely reusable" };
  }
  if (!candidateFingerprint || candidateFingerprint !== previousFingerprint) {
    return { deploy: true, reason: "verified publication evidence changed" };
  }
  return {
    deploy: false,
    reason: "current revision and verified evidence are unchanged and remain valid",
  };
}

export {
  VOLATILE_KEYS,
  canonicalizePublication,
  publicationDecision,
  publicationFingerprint,
};
