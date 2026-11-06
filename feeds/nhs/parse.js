import { normalizeNhsRttPayload } from "./rtt.js";
import { parseNhsWorkbook } from "./workbook.js";
import { extractPdfText } from "../../worker/live-polling-collector.js";
import { parseNhsRttPressNotice } from "./press-notice.js";
import {
  fetchResponse,
  MAX_RESPONSE_BYTES,
  readResponseArrayBuffer,
  readResponseText,
} from "../../worker/live-feed-common.js";
import {
  NHS_RTT_LANDING_PAGE,
  discoverNhsRttDataPage,
  discoverNhsRttPublicationLinks,
} from "./source-discovery.js";

async function collectNhsRttPublication(fetchImpl = fetch, now = new Date()) {
  const landingResponse = await fetchResponse(NHS_RTT_LANDING_PAGE, fetchImpl);
  const dataPageUrl = discoverNhsRttDataPage(
    await readResponseText(landingResponse, { label: "NHS RTT landing page" }),
    NHS_RTT_LANDING_PAGE
  );
  const dataPageResponse = await fetchResponse(dataPageUrl, fetchImpl);
  const links = discoverNhsRttPublicationLinks(
    await readResponseText(dataPageResponse, { label: "NHS RTT data page" }),
    dataPageUrl
  );
  // Keep the two large NHS assets sequential. Some edge fetches leave one
  // parallel response open long enough to hold the queue message indefinitely;
  // each bounded request now completes before the next begins.
  const workbookResponse = await fetchResponse(
    links.timeseriesUrl,
    fetchImpl,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
  );
  const workbook = await parseNhsWorkbook(
    await readResponseArrayBuffer(workbookResponse, { label: "NHS RTT workbook" }),
  );
  const pressResponse = await fetchResponse(
    links.pressNoticeUrl,
    fetchImpl,
    "application/pdf"
  );
  const press = parseNhsRttPressNotice(
    await extractPdfText(
      await readResponseArrayBuffer(pressResponse, {
        limit: MAX_RESPONSE_BYTES.pdf,
        label: "NHS RTT PDF",
      }),
    )
  );

  return normalizeNhsRttPayload(
    {
      headline: press.headline,
      specialties: press.specialties,
      missingTrusts: press.missingTrusts,
      history: workbook.history,
      annualDelta: workbook.annualDelta,
      source: {
        landingUrl: NHS_RTT_LANDING_PAGE,
        dataPageUrl,
        pressNoticeUrl: links.pressNoticeUrl,
        timeseriesUrl: links.timeseriesUrl,
      },
    },
    now
  );
}

/**
 * Feed interface (target design 2.3). Wraps the existing collector without
 * changing what it fetches or returns: `data` is exactly the normalised NHS RTT
 * payload collectNhsRttPublication has always produced.
 *
 * @param {{fetch: typeof fetch, now: Date}} ctx
 */
async function collect(ctx) {
  return { data: await collectNhsRttPublication(ctx.fetch, ctx.now) };
}

export { collect, collectNhsRttPublication };
