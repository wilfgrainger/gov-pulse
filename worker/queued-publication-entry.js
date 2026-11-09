import { BETTING_CRON } from "./publication-schedule.js";
import { enqueuePublicationRun } from "./publication-run-lifecycle.js";
import { refreshJobs } from "./publication-plan.js";
import {
  BOOTSTRAP_CONTRACTS_DEADLINE_SECONDS,
  BOOTSTRAP_DEADLINE_SECONDS,
  BOOTSTRAP_FINALISE_DELAY_SECONDS,
  dispatchPublicationMessage,
} from "./publication-queue-dispatcher.js";

const ENQUEUE_RETRY_DELAYS_MS = [1_000, 4_000];

// enqueuePublicationRun resumes from its write-ahead lease, so a retry re-sends
// only what did not go out. Three attempts ride out a short Queue outage; a
// longer one leaves the day unpublished, and the error is logged.
async function enqueueWithRetries(env, now, scope) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await enqueuePublicationRun(env, now, scope, { publishedOnly: true });
    } catch (error) {
      if (attempt === ENQUEUE_RETRY_DELAYS_MS.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, ENQUEUE_RETRY_DELAYS_MS[attempt]));
    }
  }
}

const queuedPublicationWorker = {
  async fetch(request) {
    // The deployed entrypoint is public-data-entry.js. This Worker only owns
    // scheduled collection and Queue processing.
    void request;
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const now = new Date(controller.scheduledTime ?? Date.now());
        const scope = controller.cron === BETTING_CRON ? "betting" : "daily";
        if (refreshJobs("scheduled", scope, { publishedOnly: true }).length === 0) return;
        await enqueueWithRetries(env, now, scope);
      })().catch((error) => {
        console.error("Cloudflare publication scheduling failed", {
          cron: controller.cron,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );
  },

  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      await dispatchPublicationMessage(message, env, ctx);
    }
  },
};

export {
  BOOTSTRAP_CONTRACTS_DEADLINE_SECONDS,
  BOOTSTRAP_DEADLINE_SECONDS,
  BOOTSTRAP_FINALISE_DELAY_SECONDS,
};

export {
  BETTING_CRON,
  DAILY_CRON,
} from "./publication-schedule.js";

export {
  BOOTSTRAP_FINALISE_RETRY_SECONDS,
  FINALISE_DELAY_SECONDS,
  createRun,
  enqueueCompletedBootstrapFinaliser,
  enqueuePublicationRun,
  finaliseRun,
  recordFinaliseFailure,
} from "./publication-run-lifecycle.js";

export {
  EXTERNAL_SECTIONS,
  GENERIC_SECTIONS,
  PUBLISHED_SECTIONS,
  jobsForDay,
  refreshJobs,
} from "./publication-plan.js";

export {
  missingRequiredSections,
  publicationFragments,
  publishFromCaches,
} from "./publication-publisher.js";

export {
  PUBLICATION_SECTION_PREFIX,
  storeExternalSection,
  storeSectionFragment,
} from "./publication-collection-runner.js";

export { processQueueJob } from "./publication-job-runner.js";

export { enqueueInternationalComparisonRefresh } from "./publication-comparison-runner.js";

export {
  RUN_PREFIX,
  bootstrapRunId,
  runIdFor,
} from "./publication-run-store.js";


export default queuedPublicationWorker;
