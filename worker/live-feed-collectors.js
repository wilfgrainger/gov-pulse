import { collectBettingOdds } from "./live-betting-collector.js";
import { collectNhsRttPublication } from "./live-nhs-publication-collector.js";
import { collectElectionPolling } from "./live-polling-collector.js";
import { sectionRecord } from "./live-feed-common.js";

async function collectExternalSection(section, options = {}) {
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (section === "bettingOdds") {
    return sectionRecord(
      section,
      await collectBettingOdds(fetchImpl, now),
      now,
      "Oddschecker public British politics market pages",
      "cloudflare-direct-html"
    );
  }
  if (section === "electionPolling") {
    return sectionRecord(
      section,
      await collectElectionPolling(fetchImpl, now),
      now,
      "YouGov primary voting-intention article and result tables",
      "cloudflare-primary-publication"
    );
  }
  if (section === "nhsStats") {
    return sectionRecord(
      section,
      await collectNhsRttPublication(fetchImpl, now),
      now,
      "NHS England RTT press notice and overview time-series workbook",
      "cloudflare-official-publication"
    );
  }
  throw new Error(`No external collector is registered for '${section}'`);
}

export { collectExternalSection };
