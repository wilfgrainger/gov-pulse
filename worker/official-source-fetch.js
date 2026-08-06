import {
  MAX_RESPONSE_BYTES,
  assertSameHttpsHost,
  readResponseText,
} from "./response-limits.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const ONS_REQUEST_INTERVAL_MS = 1_000;
const TRANSIENT_RETRY_DELAYS_MS = [0, 1_500, 5_000];
const USER_AGENT =
  "gov-pulse-source-checker/5.0 (+https://github.com/wilfgrainger/gov-pulse)";
const NATIVE_FETCH = globalThis.fetch;

let onsQueue = Promise.resolve();
let lastOnsRequestStartedAt = 0;

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function isOnsUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase() === "www.ons.gov.uk";
  } catch {
    return false;
  }
}

async function waitForOnsSlot(url, fetchImpl) {
  // Production requests share one conservative queue across every connector.
  // Injected test fetchers stay immediate and deterministic.
  if (!isOnsUrl(url) || fetchImpl !== NATIVE_FETCH) return;

  const previous = onsQueue;
  let release;
  onsQueue = new Promise((resolve) => {
    release = resolve;
  });

  await previous;
  const remaining = Math.max(
    0,
    ONS_REQUEST_INTERVAL_MS - (Date.now() - lastOnsRequestStartedAt)
  );
  if (remaining > 0) await sleep(remaining);
  lastOnsRequestStartedAt = Date.now();
  release();
}

function retryDelay(response, fallbackMs) {
  const header = response.headers?.get?.("retry-after");
  const seconds = Number.parseInt(header ?? "", 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(15_000, seconds * 1_000);
  }
  return fallbackMs;
}

async function cancelBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Releasing an unsuccessful response body is best effort only.
  }
}

async function fetchOfficialResponse(
  url,
  {
    accept = "text/html,text/csv;q=0.9,text/plain;q=0.8,*/*;q=0.5",
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    sourceName = isOnsUrl(url) ? "ONS" : "Official source",
  } = {}
) {
  let lastError = null;
  let nextDelayMs = 0;

  for (let index = 0; index < TRANSIENT_RETRY_DELAYS_MS.length; index += 1) {
    const configuredDelay = nextDelayMs || TRANSIENT_RETRY_DELAYS_MS[index];
    if (index > 0 && fetchImpl === NATIVE_FETCH && configuredDelay > 0) {
      await sleep(configuredDelay);
    }
    nextDelayMs = 0;
    await waitForOnsSlot(url, fetchImpl);

    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: accept, "User-Agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastError = error;
      continue;
    }

    if (response.ok) {
      assertSameHttpsHost(response, url, sourceName);
      return response;
    }

    lastError = new Error(`${sourceName} returned ${response.status} for ${url}`);
    const transient = response.status === 429 || response.status >= 500;
    await cancelBody(response);
    if (!transient) throw lastError;

    if (index + 1 < TRANSIENT_RETRY_DELAYS_MS.length && fetchImpl === NATIVE_FETCH) {
      nextDelayMs = retryDelay(
        response,
        TRANSIENT_RETRY_DELAYS_MS[index + 1]
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to retrieve ${url}`);
}

async function fetchOfficialText(url, options = {}) {
  return readResponseText(await fetchOfficialResponse(url, options), {
    limit: MAX_RESPONSE_BYTES.text,
    label: options.sourceName ?? "Official source text",
  });
}

export {
  DEFAULT_TIMEOUT_MS,
  ONS_REQUEST_INTERVAL_MS,
  TRANSIENT_RETRY_DELAYS_MS,
  fetchOfficialResponse,
  fetchOfficialText,
  isOnsUrl,
};
