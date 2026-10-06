import { pathToFileURL } from "node:url";
import { isCurrentGovernmentContractsPayload } from "../contracts/government-contracts.js";
import {
  FEED_REGISTRY_VERSION,
} from "../worker/feed-registry.js";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import { validatePublicProjection, validateSnapshot } from "./lib/publication-validation.mjs";

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
  return validatePublicProjection(snapshot);
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
    // Reader artifacts expose only the published projection. Internal feed
    // readiness and source rejection details stay on the operator health path.
    verifiedSections = validateSnapshot(currentSnapshot, 1, []);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }

  const publicationState = validatePublicationState(
    currentSnapshot
  );
  const governmentContracts = validateGovernmentContractsExtension(
    currentSnapshot,
    checkedAt
  );
  console.log(
    JSON.stringify(
      {
        status: "ok",
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
