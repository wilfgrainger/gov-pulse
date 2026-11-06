import {
  PUBLICATION_COMMIT_KEY,
  PUBLICATION_CURRENT_KEY,
  PUBLICATION_HISTORY_PREFIX,
  PUBLICATION_STATUS_KEY,
  isSnapshot,
  mergePublication,
  readCurrentPublication,
} from "./publication-entry.js";
import { CURRENT_RECORD_KEY as CONTRACT_CURRENT_RECORD_KEY } from "../feeds/government-contracts/parse.js";
import { FEED_REGISTRY, FEED_REGISTRY_VERSION, REQUIRED_PUBLISHED_SECTION_IDS } from "./feed-registry.js";
import { currentSectionRecord, filterCurrentSnapshot, filterPublicationSnapshot } from "../contracts/evidence-policy.js";
import { PUBLIC_SNAPSHOT_KEY, buildPublicSnapshotArtifact } from "./public-snapshot.js";
import { samePublicationEvidence } from "../contracts/publication-evidence.js";
import { buildPublicationDiagnostics } from "../contracts/publication-diagnostics.js";
import { archiveEdition, reconcileRetainedEditionSummaries } from "./edition-archive.js";
import {
  RUN_PREFIX,
  kvDelete,
  kvGet,
  kvGetWithMetadata,
  kvPut,
  kvPutText,
  terminalKey,
} from "./publication-run-store.js";
import { unavailableSectionsFor } from "./publication-availability.js";
import { PUBLISHED_SECTIONS } from "./publication-plan.js";
import { PUBLICATION_SECTION_PREFIX } from "./publication-collection-runner.js";
import { fetchPublicationSeedSnapshot } from "./publication-recovery.js";

const PUBLICATION_HISTORY_TTL_SECONDS = 14 * 24 * 60 * 60;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function publicationFragments(env, now = new Date(), runId = null) {
  const records = [];
  for (const section of PUBLISHED_SECTIONS) {
    let record = null;
    if (typeof runId === "string" && runId.trim()) {
      record = await kvGet(env, `${RUN_PREFIX}${runId}:section:${section}`);
    }
    if (!record) {
      record = await kvGet(env, `${PUBLICATION_SECTION_PREFIX}${section}`);
    }
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
  const fragments = await publicationFragments(env, now, options.runId ?? null);
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
      console.error("Publication edition archive failed", {
        editionId: publication.meta.measureCatalog.editionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  } else {
    throw new Error("Publication snapshot has no archivable measure edition");
  }

  publication.meta.delivery = "published-snapshot";
  publication.meta.publicationDiagnostics = buildPublicationDiagnostics(
    publication,
    Object.keys(FEED_REGISTRY),
  );

  const publicProjection = filterPublicationSnapshot(publication);
  const publicArtifact = publicProjection
    ? buildPublicSnapshotArtifact(publicProjection, now)
    : null;

  const runId = typeof options.runId === "string" && options.runId.trim() ? options.runId : null;
  const unavailableSections = await unavailableSectionsFor(
    publication,
    async (jobId) => (runId ? kvGet(env, terminalKey(runId, jobId)) : null),
  );

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
    ...(unavailableSections.length > 0 ? { unavailableSections } : {}),
  };

  const commitManifest = publicArtifact
    ? {
        schemaVersion: 1,
        editionId: publication.meta.measureCatalog?.editionId ?? null,
        generatedAt: publication.meta.generatedAt,
        publishedAt: now.toISOString(),
        status: status.status,
        missingRequired,
        registryVersion: FEED_REGISTRY_VERSION,
        validUntil: publicArtifact.metadata?.validUntil ?? null,
        delivery: publication.meta.delivery,
      }
    : null;
  if (commitManifest) {
    publication.meta.commitManifest = commitManifest;
  }

  const previousPublicRecord = await kvGetWithMetadata(env, PUBLIC_SNAPSHOT_KEY, "text");
  const previousCurrentRecord = current;
  const previousStatusRecord = await kvGet(env, PUBLICATION_STATUS_KEY);

  let publicArtifactWritten = false;
  let currentWritten = false;
  let statusWritten = false;

  try {
    if (changed) {
      await kvPut(
        env,
        `${PUBLICATION_HISTORY_PREFIX}${now.toISOString().replaceAll(":", "-")}`,
        publication,
        { expirationTtl: PUBLICATION_HISTORY_TTL_SECONDS }
      );
    }

    if (publicArtifact) {
      await kvPutText(env, PUBLIC_SNAPSHOT_KEY, publicArtifact.body, {
        metadata: {
          ...publicArtifact.metadata,
          editionId: publication.meta.measureCatalog?.editionId ?? null,
        },
      });
      publicArtifactWritten = true;
    }

    await kvPut(env, PUBLICATION_CURRENT_KEY, publication);
    currentWritten = true;

    await kvPut(env, PUBLICATION_STATUS_KEY, status);
    statusWritten = true;

    if (commitManifest) {
      await kvPut(env, PUBLICATION_COMMIT_KEY, commitManifest);
    }
  } catch (error) {
    try {
      if (statusWritten) {
        if (previousStatusRecord) {
          await kvPut(env, PUBLICATION_STATUS_KEY, previousStatusRecord);
        } else {
          await kvDelete(env, PUBLICATION_STATUS_KEY);
        }
      }
      if (currentWritten) {
        if (previousCurrentRecord) {
          await kvPut(env, PUBLICATION_CURRENT_KEY, previousCurrentRecord);
        } else {
          await kvDelete(env, PUBLICATION_CURRENT_KEY);
        }
      }
      if (publicArtifactWritten) {
        if (previousPublicRecord?.value) {
          await kvPutText(env, PUBLIC_SNAPSHOT_KEY, previousPublicRecord.value, {
            metadata: previousPublicRecord.metadata,
          });
        } else {
          await kvDelete(env, PUBLIC_SNAPSHOT_KEY);
        }
      }
    } catch (rollbackError) {
      console.error("Publication rollback failed", {
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }
    throw error;
  }

  return { publication, status, changed, commitManifest };
}

export {
  PUBLICATION_HISTORY_TTL_SECONDS,
  missingRequiredSections,
  publicationFragments,
  publishFromCaches,
};
