const RUN_PREFIX = "v13:publication:run:";
const RUN_TTL_SECONDS = 14 * 24 * 60 * 60;

async function kvGet(env, key) {
  return env?.METRICS_CACHE?.get ? env.METRICS_CACHE.get(key, "json") : null;
}

async function kvPut(env, key, value, options) {
  if (!env?.METRICS_CACHE?.put) {
    throw new Error("METRICS_CACHE KV binding is required");
  }
  await env.METRICS_CACHE.put(key, JSON.stringify(value), options);
}

async function kvPutText(env, key, value, options) {
  if (!env?.METRICS_CACHE?.put) {
    throw new Error("METRICS_CACHE KV binding is required");
  }
  await env.METRICS_CACHE.put(key, value, options);
}

function runIdFor(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Run time must be a valid Date");
  }
  return now.toISOString().replaceAll(":", "-");
}

function bootstrapRunId(deploymentId) {
  const normalized = String(deploymentId ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error("Bootstrap deploymentId must be a full Git commit SHA");
  }
  return `bootstrap-${normalized}`;
}

function runKey(runId) {
  return `${RUN_PREFIX}${String(runId)}`;
}

function terminalKey(runId, jobId) {
  return `${RUN_PREFIX}${String(runId)}:terminal:${String(jobId)}`;
}

export {
  RUN_PREFIX,
  RUN_TTL_SECONDS,
  bootstrapRunId,
  kvGet,
  kvPut,
  kvPutText,
  runIdFor,
  runKey,
  terminalKey,
};
