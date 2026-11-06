/**
 * Public availability of published evidence families.
 *
 * A family that config/publications.json marks `published` but that has no
 * section in the current publication is unavailable, never zero or carried
 * over. The publisher records one coarse reason per such family in its small
 * status record; /data/health.json reads the reason from there. Reasons are a
 * closed vocabulary so collector errors, KV keys and stack traces never reach
 * public output:
 *
 *   - "not-scheduled": no collection job exists for the family.
 *   - "collector-failed": the run's collection job for the family ended in
 *     failure or did not finish before the run was finalised.
 *   - "no-current-observation": collection finished (or no run outcome is
 *     known) but no record inside its currentness contract is available.
 */
import { publicationPublished } from "../contracts/evidence-policy.js";
import {
  OPTIONAL_PUBLISHED_SECTION_IDS,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../feeds/registry.js";
import { collectionPlanFor } from "./publication-plan.js";

const UNAVAILABLE_REASONS = Object.freeze([
  "no-current-observation",
  "collector-failed",
  "not-scheduled",
]);

const SNAPSHOT_FAMILY_IDS = Object.freeze([
  ...new Set([...REQUIRED_PUBLISHED_SECTION_IDS, ...OPTIONAL_PUBLISHED_SECTION_IDS]),
]);

function collectionJobIdFor(family) {
  if (family === "governmentContracts") return "contracts";
  const plan = collectionPlanFor(family);
  if (!plan) return null;
  return `${plan.jobType === "refresh-section" ? "section" : "external"}:${family}`;
}

/**
 * @param {string} family
 * @param {{status?: string} | null} terminal the run's terminal record for the
 *   family's collection job, when the run is known.
 */
function unavailableReasonFor(family, terminal) {
  if (!collectionJobIdFor(family)) return "not-scheduled";
  if (terminal && typeof terminal === "object" && terminal.status !== "success") {
    return "collector-failed";
  }
  return "no-current-observation";
}

function sectionPresent(snapshot, family) {
  return Boolean(snapshot?.meta?.sources?.[family]) &&
    Object.prototype.hasOwnProperty.call(snapshot, family);
}

/** Published snapshot families that the given snapshot does not carry. */
function absentPublishedFamilies(snapshot) {
  return SNAPSHOT_FAMILY_IDS
    .filter((family) => publicationPublished(family))
    .filter((family) => !sectionPresent(snapshot, family))
    .sort();
}

/**
 * Publisher side: reasons for each absent published family, from the run's
 * terminal job records. `readTerminal(jobId)` returns the terminal or null.
 */
async function unavailableSectionsFor(snapshot, readTerminal = async () => null) {
  const entries = [];
  for (const family of absentPublishedFamilies(snapshot)) {
    const jobId = collectionJobIdFor(family);
    const terminal = jobId ? await readTerminal(jobId) : null;
    entries.push({ id: family, reason: unavailableReasonFor(family, terminal) });
  }
  return entries;
}

/**
 * Health side: list every published family absent from the current snapshot,
 * taking each reason from the publisher's status record when it is a known
 * reason, and otherwise the conservative "no-current-observation" (for
 * example a section that aged out of its contract after publication). Only
 * `{ id, reason }` is ever returned.
 */
function publicUnavailableSections(snapshot, statusRecord) {
  const recorded = new Map();
  if (Array.isArray(statusRecord?.unavailableSections)) {
    for (const entry of statusRecord.unavailableSections) {
      if (
        typeof entry?.id === "string" &&
        UNAVAILABLE_REASONS.includes(entry?.reason) &&
        !recorded.has(entry.id)
      ) {
        recorded.set(entry.id, entry.reason);
      }
    }
  }
  return absentPublishedFamilies(snapshot).map((family) => ({
    id: family,
    reason: recorded.get(family) ?? "no-current-observation",
  }));
}

export {
  SNAPSHOT_FAMILY_IDS,
  UNAVAILABLE_REASONS,
  absentPublishedFamilies,
  collectionJobIdFor,
  publicUnavailableSections,
  unavailableReasonFor,
  unavailableSectionsFor,
};
