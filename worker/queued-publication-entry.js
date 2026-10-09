import { BETTING_CRON } from "./publication-schedule.js";
import { enqueuePublicationRun } from "./publication-run-lifecycle.js";
import {
  BOOTSTRAP_CONTRACTS_DEADLINE_SECONDS,
  BOOTSTRAP_DEADLINE_SECONDS,
  BOOTSTRAP_FINALISE_DELAY_SECONDS,
  dispatchPublicationMessage,
} from "./publication-queue-dispatcher.js";

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
        await enqueuePublicationRun(env, now, scope);
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
