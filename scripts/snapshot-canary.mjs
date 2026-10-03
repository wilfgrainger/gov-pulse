import { pathToFileURL } from "node:url";
import { isCurrentGovernmentContractsPayload } from "../contracts/government-contracts.js";
import {
  FEED_REGISTRY_VERSION,
} from "../worker/feed-registry.js";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import { currentPublicationManifest } from "./publication-manifest.mjs";
import { validateSnapshot } from "./build-static-snapshot.mjs";

const maximumBuildAgeMs = 6 * 60 * 60 * 1000;
const maximumFutureSkewMs = 5 * 60 * 1000;

export function validateSnapshotAge(rawGeneratedAt, nowMs = Date.now()) {
  const generatedAt = Date.parse(rawGeneratedAt ?? "");
  const ageMs = nowMs - generatedAt;
  if (
    !Number.isFinite(generatedAt) ||
    ageMs < -maximumFutureSkewMs ||
    ageMs > maximumBuildAgeMs
  ) {
    throw new Error("Published snapshot is outside the six-hour canary window");
  }
}

function validateGovernmentContractsExtension(snapshot, now = new Date()) {
  const source = snapshot?.meta?.sources?.governmentContracts;
  if (source?.status !== "ok") return "unavailable";
  if (source.cacheState !== "fresh") {
    throw new Error("Published government contracts evidence is not fresh");
  }
  if (!isCurrentGovernmentContractsPayload(snapshot.governmentContracts, now)) {
    throw new Error("Published government contracts evidence is not canonical and current");
  }
  return "current";
}

export function validatePublicationState(snapshot) {
  const meta = snapshot?.meta;
  const sourceErrors = Object.values(meta?.sources ?? {}).some(
    (source) => source && typeof source === "object" &&
      Object.prototype.hasOwnProperty.call(source, "error")
  );
  if (
    Object.prototype.hasOwnProperty.call(meta ?? {}, "publicationDiagnostics") ||
    Object.prototype.hasOwnProperty.call(meta ?? {}, "measureCatalogDiagnostics") ||
    sourceErrors
  ) {
    throw new Error("Published snapshot exposes private diagnostics");
  }

  const {
    missingRequiredSections: requiredUnavailableSections,
    unavailableOptionalSections: optionalUnavailableSections,
  } = currentPublicationManifest(snapshot);
  const declaredMissing = meta?.missingRequiredSections;
  const expectedMissing = requiredUnavailableSections;
  if (
    !Array.isArray(declaredMissing) ||
    declaredMissing.some((section) => typeof section !== "string") ||
    JSON.stringify([...declaredMissing].sort()) !== JSON.stringify(expectedMissing) ||
    meta?.publicationState !== (expectedMissing.length ? "degraded" : "ready")
  ) {
    throw new Error("Published snapshot missing-section manifest is inconsistent");
  }

  return { requiredUnavailableSections, optionalUnavailableSections };
}

async function main(rawUrl) {
  if (!rawUrl) throw new Error("A published snapshot URL is required");
  const snapshotUrl = new URL(rawUrl).toString();
  const response = await fetch(snapshotUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Published snapshot returned ${response.status}`);
  }

  let snapshot;
  try {
    snapshot = await response.json();
  } catch {
    throw new Error("Published snapshot returned invalid JSON");
  }

  const checkedAt = new Date();
  const currentSnapshot = filterCurrentSnapshot(snapshot, checkedAt);
  if (!currentSnapshot) {
    throw new Error("Published snapshot contains no current source-owned evidence");
  }

  let verifiedSections;
  try {
    // A release may be explicitly degraded when one or more sources are unavailable.
    // The public manifest records which required sections are missing; source rejection
    // categories and raw errors stay in private operator state.
    verifiedSections = validateSnapshot(currentSnapshot, 1, []);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }

  const publicationState = validatePublicationState(
    currentSnapshot
  );
  if (currentSnapshot.meta.delivery !== "published-snapshot") {
    throw new Error("Published data is not marked as a verified snapshot");
  }
  const governmentContracts = validateGovernmentContractsExtension(
    currentSnapshot,
    checkedAt
  );
  console.log(
    JSON.stringify(
      {
        status: publicationState.requiredUnavailableSections.length > 0 ? "degraded" : "ok",
        snapshotUrl,
        registryVersion: FEED_REGISTRY_VERSION,
        generatedAt: currentSnapshot.meta.generatedAt,
        verifiedSections,
        ...publicationState,
        governmentContracts,
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rawUrl = process.argv[2] ?? process.env.METRICS_SNAPSHOT_URL;
  main(rawUrl).catch((error) => {
    console.error(
      JSON.stringify(
        {
          status: "failed",
          checkedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      )
    );
    process.exit(1);
  });
}

export { main, validateGovernmentContractsExtension };
