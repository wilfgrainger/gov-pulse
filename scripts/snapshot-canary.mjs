import { pathToFileURL } from "node:url";
import { isCurrentGovernmentContractsPayload } from "../contracts/government-contracts.js";
import {
  classifyPublicationDiagnostic,
  validatePublicationDiagnostics,
} from "../contracts/publication-diagnostics.js";
import {
  FEED_REGISTRY_VERSION,
  OPTIONAL_PUBLISHED_SECTION_IDS,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../worker/feed-registry.js";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
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

function diagnosticError(message, publicationDiagnostics) {
  const error = new Error(message);
  error.publicationDiagnostics = publicationDiagnostics;
  return error;
}

function singleDiagnostic(section, source) {
  return {
    [section]: classifyPublicationDiagnostic({ section, source }),
  };
}

export function validatePublishedDiagnostics(snapshot, verifiedSections) {
  let diagnostics;
  try {
    diagnostics = validatePublicationDiagnostics(snapshot?.meta?.publicationDiagnostics);
  } catch (error) {
    throw diagnosticError(
      error instanceof Error ? error.message : String(error),
      singleDiagnostic("snapshot", {
        status: "error",
        cacheState: "missing",
        error: "Publication contract validation failed",
      })
    );
  }

  const unavailableSections = [
    ...REQUIRED_PUBLISHED_SECTION_IDS,
    ...OPTIONAL_PUBLISHED_SECTION_IDS,
  ].filter((section) => !verifiedSections.includes(section));
  const uncoveredSections = unavailableSections.filter((section) => !diagnostics[section]);
  if (uncoveredSections.length > 0) {
    const missing = Object.fromEntries(
      uncoveredSections.map((section) => [
        section,
        classifyPublicationDiagnostic({ section, source: null }),
      ])
    );
    throw diagnosticError(
      `Published diagnostics do not cover unavailable sections: ${uncoveredSections.join(", ")}`,
      { ...diagnostics, ...missing }
    );
  }
  return diagnostics;
}

async function main(rawUrl) {
  if (!rawUrl) throw new Error("A published snapshot URL is required");
  const snapshotUrl = new URL(rawUrl).toString();
  const response = await fetch(snapshotUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw diagnosticError(
      `Published snapshot returned ${response.status}`,
      singleDiagnostic("snapshot", null)
    );
  }

  let snapshot;
  try {
    snapshot = await response.json();
  } catch {
    throw diagnosticError(
      "Published snapshot returned invalid JSON",
      singleDiagnostic("snapshot", {
        status: "error",
        cacheState: "missing",
        error: "Invalid JSON response",
      })
    );
  }

  const checkedAt = new Date();
  const currentSnapshot = filterCurrentSnapshot(snapshot, checkedAt);
  if (!currentSnapshot) {
    throw diagnosticError(
      "Published snapshot contains no current source-owned evidence",
      singleDiagnostic("snapshot", {
        status: "error",
        cacheState: "expired",
        error: "Wall-clock currentness validation removed every section",
      })
    );
  }

  let verifiedSections;
  try {
    // A release may be explicitly degraded when one or more sources are unavailable.
    // Integrity is enforced below by requiring a public diagnostic for every absent
    // required/optional section; completeness is not a prerequisite for code rollout.
    verifiedSections = validateSnapshot(currentSnapshot, 1, []);
  } catch (error) {
    let diagnostics = {};
    try {
      diagnostics = validatePublicationDiagnostics(currentSnapshot?.meta?.publicationDiagnostics);
    } catch {
      diagnostics = singleDiagnostic("snapshot", {
        status: "error",
        cacheState: "missing",
        error: "Publication contract validation failed",
      });
    }
    throw diagnosticError(
      error instanceof Error ? error.message : String(error),
      diagnostics
    );
  }

  const publicationDiagnostics = validatePublishedDiagnostics(
    currentSnapshot,
    verifiedSections
  );
  if (currentSnapshot.meta.delivery !== "published-snapshot") {
    throw diagnosticError(
      "Published data is not marked as a verified snapshot",
      publicationDiagnostics
    );
  }
  const governmentContracts = validateGovernmentContractsExtension(
    currentSnapshot,
    checkedAt
  );
  const requiredUnavailableSections = REQUIRED_PUBLISHED_SECTION_IDS.filter(
    (section) => !verifiedSections.includes(section)
  );
  const optionalUnavailableSections = OPTIONAL_PUBLISHED_SECTION_IDS.filter(
    (section) => !verifiedSections.includes(section)
  );
  console.log(
    JSON.stringify(
      {
        status: requiredUnavailableSections.length > 0 ? "degraded" : "ok",
        snapshotUrl,
        registryVersion: FEED_REGISTRY_VERSION,
        generatedAt: currentSnapshot.meta.generatedAt,
        verifiedSections,
        requiredUnavailableSections,
        optionalUnavailableSections,
        publicationDiagnostics: Object.values(publicationDiagnostics),
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
          publicationDiagnostics: Object.values(error?.publicationDiagnostics ?? {}),
        },
        null,
        2
      )
    );
    process.exit(1);
  });
}

export { main, validateGovernmentContractsExtension };
