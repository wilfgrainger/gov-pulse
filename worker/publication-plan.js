import { REQUIRED_PUBLISHED_SECTION_IDS } from "./feed-registry.js";

const SECTION_COLLECTION_PLAN = Object.freeze({
  gdpTracker: Object.freeze({ jobType: "refresh-section", collector: "section-builder" }),
  sentimentPulse: Object.freeze({ jobType: "refresh-section", collector: "section-builder" }),
  employmentStats: Object.freeze({ jobType: "refresh-section", collector: "section-builder" }),
  taxRevenue: Object.freeze({ jobType: "refresh-section", collector: "tax-revenue-live" }),
  nationalDebt: Object.freeze({ jobType: "refresh-section", collector: "section-builder" }),
  migrationStats: Object.freeze({ jobType: "refresh-section", collector: "section-builder" }),
  housePriceIndex: Object.freeze({ jobType: "refresh-section", collector: "section-builder" }),
  realWages: Object.freeze({ jobType: "refresh-section", collector: "section-builder" }),
  crimeStatistics: Object.freeze({ jobType: "refresh-section", collector: "section-builder" }),
  electionPolling: Object.freeze({ jobType: "refresh-external-section", collector: "external" }),
  nhsStats: Object.freeze({ jobType: "refresh-external-section", collector: "external" }),
  bettingOdds: Object.freeze({ jobType: "refresh-external-section", collector: "external" }),
  releaseCalendar: Object.freeze({ jobType: "refresh-external-section", collector: "external" }),
  nhsReleaseCalendar: Object.freeze({ jobType: "refresh-external-section", collector: "external" }),
});

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
  if (scope === "betting") {
    return sectionRefreshJobs(runId, ["bettingOdds"]);
  }

  if (!["daily", "bootstrap"].includes(scope)) {
    throw new Error(`Unknown publication refresh scope '${scope}'`);
  }

  const sections = scope === "bootstrap"
    ? PUBLISHED_SECTIONS.filter((section) => REQUIRED_SECTION_SET.has(section))
    : PUBLISHED_SECTIONS;

  const jobs = sectionRefreshJobs(runId, sections);

  if (scope === "daily" || (scope === "bootstrap" && options.includeContracts === true)) {
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
