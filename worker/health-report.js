const MANIFEST_CACHE_KEY = "v10:manifest";
const DEFAULT_FRESH_TTL_SECONDS = 4 * 60 * 60;
const DEFAULT_STALE_TTL_SECONDS = 24 * 60 * 60;

function finitePositive(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function classifyAge(fetchedAt, freshTtlSeconds, staleTtlSeconds, nowMs) {
  if (!fetchedAt) {
    return { cacheState: "missing", ageSeconds: null };
  }

  const fetchedAtMs = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedAtMs)) {
    return { cacheState: "missing", ageSeconds: null };
  }

  const ageSeconds = Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));
  if (ageSeconds <= freshTtlSeconds) {
    return { cacheState: "fresh", ageSeconds };
  }
  if (ageSeconds <= staleTtlSeconds) {
    return { cacheState: "stale", ageSeconds };
  }
  return { cacheState: "expired", ageSeconds };
}

function sectionHealth(section, descriptor, manifestEntry, options) {
  const freshTtlSeconds = finitePositive(
    descriptor?.freshTtlSeconds,
    options.defaultFreshTtlSeconds
  );
  const staleTtlSeconds = Math.max(
    freshTtlSeconds,
    finitePositive(options.defaultStaleTtlSeconds, DEFAULT_STALE_TTL_SECONDS)
  );
  const fetchedAt =
    typeof manifestEntry?.fetchedAt === "string" ? manifestEntry.fetchedAt : null;
  const age = classifyAge(fetchedAt, freshTtlSeconds, staleTtlSeconds, options.nowMs);

  let status = "ok";
  if (!manifestEntry || age.cacheState === "missing") {
    status = "missing";
  } else if (manifestEntry.status === "error") {
    status = "error";
  } else if (age.cacheState === "expired") {
    status = "expired";
  } else if (manifestEntry.status === "stale" || age.cacheState === "stale") {
    status = "stale";
  }

  return {
    section,
    status,
    healthy: status === "ok",
    source: manifestEntry?.source ?? descriptor?.source ?? "Source not configured",
    fetchedAt,
    ageSeconds: age.ageSeconds,
    cacheState: age.cacheState,
    freshTtlSeconds,
    staleTtlSeconds,
    ingestOnly: descriptor?.ingestOnly === true,
    error:
      typeof manifestEntry?.error === "string" && manifestEntry.error.trim()
        ? manifestEntry.error.trim()
        : null,
  };
}

function buildHealthReport({
  manifest,
  descriptors,
  defaultFreshTtlSeconds = DEFAULT_FRESH_TTL_SECONDS,
  defaultStaleTtlSeconds = DEFAULT_STALE_TTL_SECONDS,
  nowMs = Date.now(),
}) {
  const sourceEntries =
    manifest?.sources && typeof manifest.sources === "object" && !Array.isArray(manifest.sources)
      ? manifest.sources
      : {};
  const sections = {};

  for (const [section, descriptor] of Object.entries(descriptors ?? {})) {
    sections[section] = sectionHealth(section, descriptor, sourceEntries[section], {
      defaultFreshTtlSeconds,
      defaultStaleTtlSeconds,
      nowMs,
    });
  }

  const values = Object.values(sections);
  const counts = {
    total: values.length,
    ok: values.filter((entry) => entry.status === "ok").length,
    stale: values.filter((entry) => entry.status === "stale").length,
    expired: values.filter((entry) => entry.status === "expired").length,
    missing: values.filter((entry) => entry.status === "missing").length,
    error: values.filter((entry) => entry.status === "error").length,
  };
  const healthy = counts.total > 0 && counts.ok === counts.total;

  return {
    status: healthy ? "ok" : "degraded",
    healthy,
    service: "public-data-service",
    generatedAt: new Date(nowMs).toISOString(),
    lastRefresh:
      typeof manifest?.generatedAt === "string"
        ? manifest.generatedAt
        : typeof manifest?.fetchedAt === "string"
          ? manifest.fetchedAt
          : null,
    counts,
    sections,
  };
}

async function readManifest(env) {
  if (!env?.METRICS_CACHE?.get) {
    return null;
  }

  try {
    return await env.METRICS_CACHE.get(MANIFEST_CACHE_KEY, "json");
  } catch (error) {
    console.error("public-data.org failed to read or parse manifest from KV", error);
    return null;
  }
}

function strictHealthStatus(report, strict) {
  return strict && !report.healthy ? 503 : 200;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHealthPage(report) {
  const rows = Object.values(report.sections)
    .map(
      (entry) => `<tr><td>${escapeHtml(entry.section)}</td><td>${escapeHtml(entry.status)}</td><td>${escapeHtml(entry.fetchedAt ?? "Never")}</td><td>${escapeHtml(entry.ageSeconds == null ? "—" : `${entry.ageSeconds}s`)}</td><td>${escapeHtml(entry.source)}</td><td>${escapeHtml(entry.error ?? "")}</td></tr>`
    )
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>public-data.org source health</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f7f6f2;color:#141414}main{max-width:1100px;margin:auto;padding:32px 20px}h1{font-size:clamp(2rem,5vw,4rem);margin:0 0 8px}p{line-height:1.6}.summary{border-block:2px solid #141414;padding:16px 0;margin:24px 0}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #d8d5ce;font-size:14px}th{background:#141414;color:white}code{font-size:12px}@media(max-width:760px){table{display:block;overflow-x:auto;white-space:nowrap}}</style></head><body><main><p>public-data.org data operations</p><h1>Source health</h1><div class="summary"><strong>${escapeHtml(report.status.toUpperCase())}</strong> · ${report.counts.ok}/${report.counts.total} sources healthy · Last refresh ${escapeHtml(report.lastRefresh ?? "not recorded")}</div><table><thead><tr><th>Section</th><th>Status</th><th>Fetched</th><th>Age</th><th>Source</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table><p><a href="/health">JSON health report</a> · <a href="/health?strict=1">Strict monitoring endpoint</a></p></main></body></html>`;
}

function logHealthReport(context, report) {
  const summary = {
    context,
    status: report.status,
    counts: report.counts,
    lastRefresh: report.lastRefresh,
  };

  if (report.healthy) {
    console.info("public-data.org source health", summary);
  } else {
    console.warn("public-data.org source health degraded", summary);
    for (const entry of Object.values(report.sections)) {
      if (!entry.healthy) {
        console.warn("public-data.org source unhealthy", {
          context,
          section: entry.section,
          status: entry.status,
          fetchedAt: entry.fetchedAt,
          ageSeconds: entry.ageSeconds,
          error: entry.error,
        });
      }
    }
  }
}

export {
  DEFAULT_FRESH_TTL_SECONDS,
  DEFAULT_STALE_TTL_SECONDS,
  MANIFEST_CACHE_KEY,
  buildHealthReport,
  logHealthReport,
  readManifest,
  renderHealthPage,
  strictHealthStatus,
};
