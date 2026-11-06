import { publicationPublished } from "../contracts/evidence-policy.js";
import { REQUIRED_PUBLISHED_SECTION_IDS, collectionPlan } from "../feeds/registry.js";

const DECLARED_PLAN = collectionPlan();

// Membership is every feed that declares a collection (feeds/*/feed.js). The
// order below is the published job order of the existing feeds; feeds added
// later follow in definition order.
const PLAN_ORDER = [
  "gdpTracker", "sentimentPulse", "employmentStats", "taxRevenue", "nationalDebt", "migrationStats",
  "housePriceIndex", "realWages", "crimeStatistics", "electionPolling", "nhsStats", "bettingOdds",
  "releaseCalendar", "nhsReleaseCalendar",
];
const declaredIds = Object.keys(DECLARED_PLAN);
const SECTION_COLLECTION_PLAN = Object.freeze(Object.fromEntries(
  [
    ...PLAN_ORDER.filter((id) => declaredIds.includes(id)),
    ...declaredIds.filter((id) => !PLAN_ORDER.includes(id)),
  ].map((id) => [id, Object.freeze({ ...DECLARED_PLAN[id] })]),
));

const GENERIC_SECTIONS = Object.freeze(
  Object.entries(SECTION_COLLECTION_PLAN)
    .filter(([, plan]) => plan.jobType === "refresh-section")
    .map(([section]) => section)
);

const EXTERNAL_SECTIONS = Object.freeze(
  Object.entries(SECTION_COLLECTION_PLAN)
    .filter(([, plan]) => plan.jobType === "refresh-external-section")
    .map(([section]) => section)
);

const PUBLISHED_SECTIONS = Object.freeze(Object.keys(SECTION_COLLECTION_PLAN));
const REQUIRED_SECTION_SET = new Set(REQUIRED_PUBLISHED_SECTION_IDS);

function collectionPlanFor(section) {
  return SECTION_COLLECTION_PLAN[section] ?? null;
}

function sectionRefreshJobs(runId, sections) {
  return sections.map((section) => {
    const plan = collectionPlanFor(section);
    if (!plan) throw new Error(`No collection plan exists for '${section}'`);
    return {
      type: plan.jobType,
      section,
      runId,
      jobId: `${plan.jobType === "refresh-section" ? "section" : "external"}:${section}`,
    };
  });
}

function refreshJobs(runId, scope = "daily", options = {}) {
  // Recurring collection is narrower than bootstrap: held publications stay
  // available for recovery but do not burn KV writes every day.
  const publishedOnly = options.publishedOnly === true && scope !== "bootstrap";
  const dueForCollection = (section) => !publishedOnly || publicationPublished(section);

  if (scope === "betting") {
    return sectionRefreshJobs(
      runId,
      dueForCollection("bettingOdds") ? ["bettingOdds"] : [],
    );
  }

  if (!["daily", "bootstrap"].includes(scope)) {
    throw new Error(`Unknown publication refresh scope '${scope}'`);
  }

  const sections = (
    scope === "bootstrap"
      ? PUBLISHED_SECTIONS.filter((section) => REQUIRED_SECTION_SET.has(section))
      : PUBLISHED_SECTIONS
  ).filter(dueForCollection);

  const jobs = sectionRefreshJobs(runId, sections);

  if (
    (scope === "daily" && dueForCollection("governmentContracts")) ||
    (scope === "bootstrap" && options.includeContracts === true)
  ) {
    jobs.push({
      type: "refresh-contracts",
      runId,
      jobId: "contracts",
      ...(scope === "bootstrap" && options.includeContracts === true ? { force: true } : {}),
    });
  }

  return jobs;
}

function jobsForDay(runId = "manual") {
  return refreshJobs(runId, "daily").map((job) =>
    job.type === "refresh-contracts"
      ? { type: job.type }
      : { type: job.type, section: job.section }
  );
}

export {
  EXTERNAL_SECTIONS,
  GENERIC_SECTIONS,
  PUBLISHED_SECTIONS,
  SECTION_COLLECTION_PLAN,
  collectionPlanFor,
  jobsForDay,
  refreshJobs,
};
