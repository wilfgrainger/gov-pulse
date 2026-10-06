import {
  PUBLICATION_CURRENT_KEY,
  PUBLICATION_HISTORY_PREFIX,
  PUBLICATION_STATUS_KEY,
  isSnapshot,
  mergePublication,
  readCurrentPublication,
} from "./publication-entry.js";
import { CURRENT_RECORD_KEY as CONTRACT_CURRENT_RECORD_KEY } from "./government-contracts-cloudflare.js";
import { REQUIRED_PUBLISHED_SECTION_IDS, FEED_REGISTRY } from "./feed-registry.js";
import { currentSectionRecord, filterCurrentSnapshot } from "./publication-currentness.js";
import { PUBLIC_SNAPSHOT_KEY, buildPublicSnapshotArtifact } from "./public-snapshot.js";
import { samePublicationEvidence } from "../contracts/publication-evidence.js";
import { buildPublicationDiagnostics } from "../contracts/publication-diagnostics.js";
import { archiveEdition, reconcileRetainedEditionSummaries } from "./edition-archive.js";
import { kvGet, kvPut, kvPutText } from "./publication-run-store.js";
import { PUBLISHED_SECTIONS } from "./publication-plan.js";
import { PUBLICATION_SECTION_PREFIX } from "./publication-collection-runner.js";
import { fetchPublicationSeedSnapshot } from "./publication-recovery.js";

const PUBLICATION_HISTORY_TTL_SECONDS = 14 * 24 * 60 * 60;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function publicationFragments(env, now = new Date()) {
  const records = [];
  for (const section of PUBLISHED_SECTIONS) {
    const record = await kvGet(env, `${PUBLICATION_SECTION_PREFIX}${section}`);
    if (
      record?.section === section &&
      isRecord(record.data) &&
      currentSectionRecord(record, now)
    ) {
      records.push(record);
    }
  }
  return records;
}

function preserveEditionClock(candidate, current) {
  if (!current || !samePublicationEvidence(candidate, current)) return candidate;
  const preserved = structuredClone(candidate);
  preserved.meta.generatedAt = current.meta.generatedAt;
  preserved.meta.fetchedAt = current.meta.fetchedAt;
  return preserved;
}

function missingRequiredSections(snapshot) {
  return REQUIRED_PUBLISHED_SECTION_IDS.filter(
    (section) =>
      !snapshot?.meta?.sources?.[section] ||
      !Object.prototype.hasOwnProperty.call(snapshot, section)
  );
}

async function publishFromCaches(env, options = {}) {
  const now = options.now ?? new Date();
  const current = await readCurrentPublication(env);
  const seed = current ?? (await fetchPublicationSeedSnapshot(env, options.fetchImpl ?? fetch));
  const fragments = await publicationFragments(env, now);
  const contractsRecord = await kvGet(env, CONTRACT_CURRENT_RECORD_KEY);
  const merged = mergePublication(seed, fragments, contractsRecord, now);
  const currentCandidate = filterCurrentSnapshot(merged, now);
  if (!currentCandidate || !isSnapshot(currentCandidate)) {
    throw new Error("Publication snapshot has no current source-owned evidence");
  }

  const missingRequired = missingRequiredSections(currentCandidate).sort();
  currentCandidate.meta.publicationState =
    missingRequired.length > 0 ? "degraded" : "ready";
  currentCandidate.meta.missingRequiredSections = missingRequired;

  const publication = preserveEditionClock(currentCandidate, current);
  const changed = !current || !samePublicationEvidence(publication, current);
  if (publication.meta.measureCatalog && publication.meta.editionSummary) {
    try {
      await archiveEdition(env, publication.meta.measureCatalog, publication.meta.editionSummary);
      publication.meta.editionArchiveStatus = "ready";
      try {
        const reconciled = await reconcileRetainedEditionSummaries(
          env,
          publication.meta.measureCatalog.editionId,
        );
        if (reconciled.summary) publication.meta.editionSummary = reconciled.summary;
      } catch (error) {
        console.error("Publication edition summary reconciliation failed", {
          editionId: publication.meta.measureCatalog.editionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      publication.meta.editionArchiveStatus = "unavailable";
      console.error("Publication edition archive failed", {
        editionId: publication.meta.measureCatalog.editionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    publication.meta.editionArchiveStatus = "unavailable";
  }

  publication.meta.delivery = "published-snapshot";
  publication.meta.publicationDiagnostics = buildPublicationDiagnostics(
    publication,
    Object.keys(FEED_REGISTRY),
  );
  const publicArtifact = buildPublicSnapshotArtifact(publication, now);

  await kvPut(env, PUBLICATION_CURRENT_KEY, publication);
  await kvPutText(env, PUBLIC_SNAPSHOT_KEY, publicArtifact.body, {
    metadata: publicArtifact.metadata,
  });
  if (changed) {
    await kvPut(
      env,
      `${PUBLICATION_HISTORY_PREFIX}${now.toISOString().replaceAll(":", "-")}`,
      publication,
      { expirationTtl: PUBLICATION_HISTORY_TTL_SECONDS }
    );
  }

  const status = {
    status:
      missingRequired.length > 0
        ? "degraded"
        : changed
          ? "published"
          : "no-change",
    generatedAt: publication.meta.generatedAt,
    includedSections: Object.keys(publication.meta.sources).sort(),
    ...(missingRequired.length > 0 ? { missingRequired } : {}),
  };
  await kvPut(env, PUBLICATION_STATUS_KEY, status);
  return { publication, status, changed };
}

export {
  PUBLICATION_HISTORY_TTL_SECONDS,
  missingRequiredSections,
  publicationFragments,
  publishFromCaches,
};
