import worker, { sectionDescriptors } from "./entry.js";
import {
  isCurrentPrimaryPollPayload,
  normalizePrimaryPollPayload,
} from "./election-polls.js";

const ELECTION_SECTION = "electionPolling";
sectionDescriptors[ELECTION_SECTION].ingestOnly = true;
sectionDescriptors[ELECTION_SECTION].source = "Verified primary pollster publications";

function json(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store");
  }
  if (!headers.has("Access-Control-Allow-Origin")) {
    headers.set("Access-Control-Allow-Origin", "*");
  }
  return new Response(JSON.stringify(payload), { ...init, headers });
}

function rewriteResponse(response, payload) {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return json(payload, { status: response.status, headers });
}

function constantTimeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function ingestAuthorized(request, env) {
  const configured = typeof env?.REFRESH_SECRET === "string" ? env.REFRESH_SECRET.trim() : "";
  if (!configured) return false;
  const headerValue = request.headers.get("X-Refresh-Secret") || "";
  return constantTimeCompare(headerValue, configured);
}

async function normalizeElectionIngest(request) {
  let payload;
  try {
    payload = await request.clone().json();
  } catch {
    return null;
  }
  if (String(payload?.section ?? "").trim() !== ELECTION_SECTION) {
    return null;
  }

  const data = normalizePrimaryPollPayload(payload?.data);
  const headers = new Headers(request.headers);
  headers.delete("Content-Length");
  headers.set("Content-Type", "application/json");

  return new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...payload,
      section: ELECTION_SECTION,
      data,
      fetchedAt: `${data.latestPublicationDate}T12:00:00.000Z`,
      sourceLabel: sectionDescriptors[ELECTION_SECTION].source,
      backend: "scheduled-election-poll-ingest",
    }),
  });
}

async function enforceCurrentPolling(request, response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }

  const url = new URL(request.url);
  if (url.pathname === "/metrics" && url.searchParams.get("section") === ELECTION_SECTION) {
    let payload;
    try {
      payload = await response.clone().json();
    } catch {
      return json(
        {
          error: "Unable to fetch section 'electionPolling'",
          details: "Invalid JSON response from upstream",
        },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!isCurrentPrimaryPollPayload(payload?.data)) {
      return json(
        {
          error: "Unable to fetch section 'electionPolling'",
          details: "No current verified primary poll publication is available",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return response;
  }

  if (url.pathname === "/all") {
    let payload;
    try {
      payload = await response.clone().json();
    } catch {
      return json(
        {
          error: "Unable to fetch combined metrics",
          details: "Invalid JSON response from upstream",
        },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (payload?.electionPolling && !isCurrentPrimaryPollPayload(payload.electionPolling)) {
      delete payload.electionPolling;
      if (payload?.meta?.sources?.electionPolling) {
        payload.meta.sources.electionPolling = {
          ...payload.meta.sources.electionPolling,
          status: "error",
          cacheState: "expired",
          error: "No current verified primary poll publication is available",
        };
      }
      return rewriteResponse(response, payload);
    }
  }

  return response;
}

const primaryPollingWorker = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return worker.fetch(request, env, ctx);
    }

    const url = new URL(request.url);
    if (
      url.pathname === "/refresh" &&
      url.searchParams.get("section") === ELECTION_SECTION
    ) {
      return json(
        {
          error: "Section 'electionPolling' is ingest-only",
          details: "Use authenticated POST /ingest with verified primary poll publications",
        },
        { status: 409 }
      );
    }

    if (url.pathname === "/ingest" && request.method === "POST") {
      if (!ingestAuthorized(request, env)) {
        return worker.fetch(request, env, ctx);
      }

      try {
        const normalizedRequest = await normalizeElectionIngest(request);
        if (normalizedRequest) {
          return worker.fetch(normalizedRequest, env, ctx);
        }
      } catch (error) {
        return json(
          {
            error: "Ingest failed",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 400 }
        );
      }
    }

    const response = await worker.fetch(request, env, ctx);
    return enforceCurrentPolling(request, response);
  },

  scheduled(controller, env, ctx) {
    return worker.scheduled(controller, env, ctx);
  },
};

export {
  enforceCurrentPolling,
  ingestAuthorized,
  normalizeElectionIngest,
  sectionDescriptors,
};
export default primaryPollingWorker;
