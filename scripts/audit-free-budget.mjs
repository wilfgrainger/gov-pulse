function executionsPerDay(cron) {
  const fields = String(cron).trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Unsupported cron expression '${cron}'`);
  if (fields[2] === "*" && fields[3] === "*" && fields[4] === "*") {
    if (fields[1] === "*") return 24 * 60;
    const every = fields[1].match(/^\*\/(\d+)$/);
    if (every && Number(every[1]) > 0 && 24 % Number(every[1]) === 0) {
      return 24 / Number(every[1]);
    }
    if (/^\d{1,2}$/.test(fields[1])) return 1;
  }
  throw new Error(`Unsupported cron expression '${cron}'`);
}

function deriveScheduledWork(registry, crons, { retryDeliveries = 0 } = {}) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    throw new TypeError("Feed registry must be an object");
  }
  if (!Array.isArray(crons) || crons.length === 0) {
    throw new TypeError("At least one scheduled cron is required");
  }
  if (!Number.isSafeInteger(retryDeliveries) || retryDeliveries < 0) {
    throw new TypeError("Retry deliveries must be a non-negative integer");
  }

  const active = Object.values(registry).filter((feed) => feed?.operationalStatus === "active");
  const bettingFeeds = active.filter((feed) => feed.refreshCadence === "every 3 hours");
  // The daily run refreshes every published feed, including bettingOdds; that
  // feed also receives the separate three-hour refresh.
  const dailyFeeds = active;
  const runs = crons.map((cron) => ({ cron, count: executionsPerDay(cron) }));
  const dailyCronRuns = runs.filter(({ cron }) => cron.includes(" ") && !cron.split(/\s+/)[1].startsWith("*/")).reduce((sum, run) => sum + run.count, 0);
  const intervalRuns = runs.filter(({ cron }) => cron.split(/\s+/)[1].startsWith("*/")).reduce((sum, run) => sum + run.count, 0);
  const scheduled = dailyCronRuns * (dailyFeeds.length + 1 /* contract refresh */ + 1 /* finaliser */) +
    intervalRuns * (bettingFeeds.length + 1 /* finaliser */);
  const messagesPerDay = scheduled + retryDeliveries;
  return {
    messagesPerDay,
    operationsPerDay: messagesPerDay * 3,
    scheduledMessagesPerDay: scheduled,
    retryDeliveries,
    maximumConfiguredRetryDeliveries: scheduled * 3,
  };
}

export { deriveScheduledWork, executionsPerDay };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { FEED_REGISTRY } = await import("../worker/feed-registry.js");
  const { DAILY_CRON, BETTING_CRON } = await import("../worker/queued-publication-entry.js");
  console.log(JSON.stringify(deriveScheduledWork(FEED_REGISTRY, [DAILY_CRON, BETTING_CRON]), null, 2));
}
