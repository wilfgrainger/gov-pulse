import { refreshSectionPayload } from "./publication-entry.js";
import { collectExternalSection } from "./live-feed-collectors.js";
import { collectionPlanFor } from "./publication-plan.js";
import { kvPut } from "./publication-run-store.js";

const PUBLICATION_SECTION_PREFIX = "v12:publication:section:";

function sectionFragmentKey(section) {
  return `${PUBLICATION_SECTION_PREFIX}${String(section)}`;
}

async function storeSectionFragment(section, env, ctx) {
  const plan = collectionPlanFor(section);
  if (!plan || plan.jobType !== "refresh-section") {
    throw new Error(`Section '${section}' is outside the generic publication set`);
  }
  const record = await refreshSectionPayload(section, env, ctx);
  await kvPut(env, sectionFragmentKey(section), record);
  return record;
}

async function storeExternalSection(section, env, options = {}) {
  const plan = collectionPlanFor(section);
  if (!plan || plan.jobType !== "refresh-external-section") {
    throw new Error(`Section '${section}' is outside the external publication set`);
  }
  const record = await collectExternalSection(section, options);
  await kvPut(env, sectionFragmentKey(section), record);
  return record;
}

export {
  PUBLICATION_SECTION_PREFIX,
  sectionFragmentKey,
  storeExternalSection,
  storeSectionFragment,
};
