import {
  PUBLICATION_CURRENT_KEY,
  PUBLICATION_STATUS_KEY,
  isSnapshot,
  mergePublication,
  readCurrentPublication,
} from "./publication-entry.js";
import { CURRENT_RECORD_KEY as CONTRACT_CURRENT_RECORD_KEY } from "../feeds/government-contracts/parse.js";
import { FEED_REGISTRY, REQUIRED_PUBLISHED_SECTION_IDS } from "../feeds/registry.js";
import {
  currentSectionRecord,
  filterCurrentSnapshot,
  filterPublicationSnapshot,
  sectionPresenceDeadline,
} from "../contracts/evidence-policy.js";
import { PUBLIC_SNAPSHOT_KEY, buildPublicSnapshotArtifact } from "./public-snapshot.js";
import { samePublicationEvidence } from "../contracts/publication-evidence.js";
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
  runSectionFragmentKey,
  sectionFragmentKey,
} from "./publication-collection-runner.js";
import { fragmentRetrievalTime, readFeedRecord } from "./feed-store.js";
import { fetchPublicationSeedSnapshot } from "./publication-recovery.js";
import { isRecord } from "../contracts/records.js";

// Section records for one publication. A run reads its own run-scoped record
// and the shared (monotonic) global fragment, and uses whichever current one
// has the newer retrieval clock; a fragment never replaces newer evidence the
// committed edition already holds for that section.
async function publicationFragments(env, now = new Date(), runId = null, current = null) {
  const records = [];
  for (const section of PUBLISHED_SECTIONS) {
    const candidates = [];
    // v20 per-feed record first (preferred on a retrieval-clock tie), then the
    // run-scoped and legacy global fragments during the dual-read window.
    const feed = await readFeedRecord(env, section);
    if (feed?.record) candidates.push(feed.record);
    if (typeof runId === "string" && runId.trim()) {
      candidates.push(await kvGet(env, runSectionFragmentKey(runId, section)));
    }
    const legacy = await kvGet(env, sectionFragmentKey(section));
    candidates.push(legacy);
    if (
      feed?.record &&
      legacy?.section === section &&
      currentSectionRecord(legacy, now) &&
      JSON.stringify([feed.record.data, feed.record.source]) !==
        JSON.stringify([legacy.data, legacy.source])
    ) {
      console.warn("Feed record diverged from legacy fragment", {
        section,
        feedFetchedAt: feed.record.source?.fetchedAt ?? feed.record.fetchedAt ?? null,
        legacyFetchedAt: legacy.source?.fetchedAt ?? legacy.fetchedAt ?? null,
      });
    }
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

// When each included section leaves the committed publication. Health uses
// this for sections the public artifact never carries (held evidence), so it
// can report live readiness from the small status record instead of reading
// and copying the full internal publication.
function sectionValidUntil(publication, now = new Date()) {
  const deadlines = {};
  for (const [section, source] of Object.entries(publication.meta.sources)) {
    const deadline = sectionPresenceDeadline(section, publication[section], source, now);
    if (Number.isFinite(deadline)) deadlines[section] = new Date(deadline).toISOString();
  }
  return deadlines;
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
    sectionValidUntil: sectionValidUntil(publication, now),
    ...(missingRequired.length > 0 ? { missingRequired } : {}),
    ...(unavailableSections.length > 0 ? { unavailableSections } : {}),
  };

  // Every key written below has a reader: the public artifact (snapshot and
  // health routes, and the next publish's repair), the current record (the
  // next publish and the migration fallback) and the status record (health
  // and the next publish's rollback). No unread manifest or history copy is
  // written; the filtered edition archive is the durable history.
  const previousPublicRecord = repairedPublic.record;
  const previousCurrentRecord = current;
  const previousStatusRecord = await kvGet(env, PUBLICATION_STATUS_KEY);

  let publicArtifactWritten = false;
  let currentWritten = false;
  let statusWritten = false;

  try {
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

  return { publication, status, changed };
}

export {
  missingRequiredSections,
  publicationFragments,
  publishFromCaches,
  repairPublicRecordAgainstCurrent,
};
