import {
  PUBLICATION_COMMIT_KEY,
  PUBLICATION_CURRENT_KEY,
  PUBLICATION_HISTORY_PREFIX,
  PUBLICATION_STATUS_KEY,
  isSnapshot,
  mergePublication,
  readCurrentPublication,
} from "./publication-entry.js";
import { CURRENT_RECORD_KEY as CONTRACT_CURRENT_RECORD_KEY } from "./government-contracts-cloudflare.js";
import { FEED_REGISTRY, FEED_REGISTRY_VERSION, REQUIRED_PUBLISHED_SECTION_IDS } from "./feed-registry.js";
import { currentSectionRecord, filterCurrentSnapshot } from "./publication-currentness.js";
import { PUBLIC_SNAPSHOT_KEY, buildPublicSnapshotArtifact } from "./public-snapshot.js";
import { samePublicationEvidence } from "../contracts/publication-evidence.js";
import { filterPublicationSnapshot } from "../contracts/publication-policy.js";
import { buildPublicationDiagnostics } from "../contracts/publication-diagnostics.js";
import { archiveEdition, reconcileRetainedEditionSummaries } from "./edition-archive.js";
import {
  kvDelete,
  kvGet,
  kvGetWithMetadata,
  kvPut,
  kvPutText,
  terminalKey,
} from "./publication-run-store.js";
import { unavailableSectionsFor } from "./publication-availability.js";
import { PUBLISHED_SECTIONS } from "./publication-plan.js";
import {
  fragmentRetrievalTime,
  runSectionFragmentKey,
  sectionFragmentKey,
} from "./publication-collection-runner.js";
import { fetchPublicationSeedSnapshot } from "./publication-recovery.js";

const PUBLICATION_HISTORY_TTL_SECONDS = 14 * 24 * 60 * 60;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Section records for one publication. A run reads its own run-scoped record
// and the shared (monotonic) global fragment, and uses whichever current one
// has the newer retrieval clock; a fragment never replaces newer evidence the
// committed edition already holds for that section.
async function publicationFragments(env, now = new Date(), runId = null, current = null) {
  const records = [];
  for (const section of PUBLISHED_SECTIONS) {
    const candidates = [];
    if (typeof runId === "string" && runId.trim()) {
      candidates.push(await kvGet(env, runSectionFragmentKey(runId, section)));
    }
    candidates.push(await kvGet(env, sectionFragmentKey(section)));
    let record = null;
    for (const candidate of candidates) {
      if (
        candidate?.section !== section ||
        !isRecord(candidate.data) ||
        !currentSectionRecord(candidate, now)
      ) {
        continue;
      }
      if (
        !record ||
        (fragmentRetrievalTime(candidate) ?? -Infinity) > (fragmentRetrievalTime(record) ?? -Infinity)
      ) {
        record = candidate;
      }
    }
    if (!record) continue;
    const committedTime = fragmentRetrievalTime({ source: current?.meta?.sources?.[section] });
    const recordTime = fragmentRetrievalTime(record);
    if (committedTime !== null && (recordTime === null || recordTime < committedTime)) {
      continue;
    }
    records.push(record);
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

function publicArtifactMetadata(publication, artifact) {
  return {
    ...artifact.metadata,
    editionId: publication.meta.measureCatalog?.editionId ?? null,
  };
}

// Recovery for an interrupted publish (Worker eviction or timeout after the
// public artifact write but before PUBLICATION_CURRENT_KEY): the public record
// then describes an edition that was never committed. The committed current
// record is authoritative, so the public artifact is rebuilt from it. Costs
// one KV write only when the two records disagree; zero otherwise.
async function repairPublicRecordAgainstCurrent(env, current, now = new Date()) {
  const publicRecord = await kvGetWithMetadata(env, PUBLIC_SNAPSHOT_KEY, "text");
  if (!isSnapshot(current) || !publicRecord?.value) {
    return { record: publicRecord, repaired: false };
  }
  const metadata = isRecord(publicRecord.metadata) ? publicRecord.metadata : {};
  const currentEditionId = current.meta.measureCatalog?.editionId ?? null;
  if (
    metadata.generatedAt === current.meta.generatedAt &&
    (metadata.editionId ?? null) === currentEditionId
  ) {
    return { record: publicRecord, repaired: false };
  }

  let artifact = null;
  try {
    const projection = filterPublicationSnapshot(current);
    artifact = projection ? buildPublicSnapshotArtifact(projection, now) : null;
  } catch (error) {
    console.error("Publication public record repair could not rebuild from current", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (!artifact) return { record: publicRecord, repaired: false };

  const repairedMetadata = publicArtifactMetadata(current, artifact);
  await kvPutText(env, PUBLIC_SNAPSHOT_KEY, artifact.body, { metadata: repairedMetadata });
  console.warn("Publication public record repaired from committed current record", {
    publicGeneratedAt: metadata.generatedAt ?? null,
    currentGeneratedAt: current.meta.generatedAt,
  });
  return { record: { value: artifact.body, metadata: repairedMetadata }, repaired: true };
}

async function publishFromCaches(env, options = {}) {
  const now = options.now ?? new Date();
  const current = await readCurrentPublication(env);
  const seed = current ?? (await fetchPublicationSeedSnapshot(env, options.fetchImpl ?? fetch));
  const repairedPublic = await repairPublicRecordAgainstCurrent(env, current, now);
  const fragments = await publicationFragments(env, now, options.runId ?? null, current);
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

  const previousPublicRecord = repairedPublic.record;
  const previousCurrentRecord = current;
  const previousStatusRecord = await kvGet(env, PUBLICATION_STATUS_KEY);

  let historyKeyWritten = null;
  let publicArtifactWritten = false;
  let currentWritten = false;
  let statusWritten = false;

  try {
    if (changed) {
      const historyKey = `${PUBLICATION_HISTORY_PREFIX}${now.toISOString().replaceAll(":", "-")}`;
      await kvPut(env, historyKey, publication, {
        expirationTtl: PUBLICATION_HISTORY_TTL_SECONDS,
      });
      historyKeyWritten = historyKey;
    }

    if (publicArtifact) {
      await kvPutText(env, PUBLIC_SNAPSHOT_KEY, publicArtifact.body, {
        metadata: publicArtifactMetadata(publication, publicArtifact),
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
      if (historyKeyWritten) {
        await kvDelete(env, historyKeyWritten);
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
  repairPublicRecordAgainstCurrent,
};
