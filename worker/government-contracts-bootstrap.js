import {
  CURRENT_RECORD_KEY,
  MAX_REQUESTS_PER_RUN as PASS_REQUEST_LIMIT,
  refreshGovernmentContracts as refreshPass,
} from "./government-contracts-cloudflare.js";

const MAX_BOOTSTRAP_PASSES = 3;
const MAX_REQUESTS_PER_RUN = PASS_REQUEST_LIMIT * MAX_BOOTSTRAP_PASSES;

async function refreshGovernmentContracts(env, options = {}) {
  const collected = [];
  let requestsMade = 0;
  let latest = null;

  for (let pass = 0; pass < MAX_BOOTSTRAP_PASSES; pass += 1) {
    latest = await refreshPass(env, options);
    collected.push(...latest.collected);
    requestsMade += latest.requestsMade;
    if (latest.updated || latest.completeDays >= 7) break;
  }

  if (requestsMade > MAX_REQUESTS_PER_RUN) {
    throw new Error("Government contracts bootstrap exceeded its request budget");
  }

  return {
    ...latest,
    collected: [...new Set(collected)].sort(),
    requestsMade,
  };
}

export {
  CURRENT_RECORD_KEY,
  MAX_BOOTSTRAP_PASSES,
  MAX_REQUESTS_PER_RUN,
  refreshGovernmentContracts,
};
