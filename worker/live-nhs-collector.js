import { normalizeNhsRttPayload } from "./nhs-rtt.js";
import { extractPdfText } from "./live-polling-collector.js";
import { parseNhsRttPressNotice } from "./nhs-press-notice.js";
import {
  absoluteUrl,
  decodeHtml,
  fetchResponse,
  MAX_RESPONSE_BYTES,
  parseAttributes,
  readResponseArrayBuffer,
  readResponseText,
} from "./live-feed-common.js";

const NHS_RTT_DATA_PAGE =
  "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2026-27/";
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_NUMBER = Object.freeze({
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
});

async function inflate(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function u16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

async function zipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let eocd = -1;
  for (
    let index = bytes.length - 22;
    index >= Math.max(0, bytes.length - 65_557);
    index -= 1
  ) {
    if (u32(bytes, index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("Workbook was not a valid ZIP archive");

  const total = u16(bytes, eocd + 10);
  if (total <= 0 || total > 200) {
    throw new Error("Workbook central directory had an unsafe entry count");
  }
  let cursor = u32(bytes, eocd + 16);
  const entries = new Map();
  for (let count = 0; count < total; count += 1) {
    if (u32(bytes, cursor) !== 0x02014b50) {
      throw new Error("Workbook central directory was invalid");
    }
    const method = u16(bytes, cursor + 10);
    const compressedSize = u32(bytes, cursor + 20);
    const fileNameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const localOffset = u32(bytes, cursor + 42);
    const name = new TextDecoder().decode(
      bytes.subarray(cursor + 46, cursor + 46 + fileNameLength)
    );
    if (u32(bytes, localOffset) !== 0x04034b50) {
      throw new Error("Workbook local entry was invalid");
    }
    const localNameLength = u16(bytes, localOffset + 26);
    const localExtraLength = u16(bytes, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(start, start + compressedSize);
    const requiredEntry =
      name === "xl/workbook.xml" ||
      name === "xl/_rels/workbook.xml.rels" ||
      name === "xl/sharedStrings.xml" ||
      /^xl\/worksheets\/[^/]+\.xml$/i.test(name);
    if (requiredEntry) {
      const data = method === 0
        ? compressed
        : method === 8
          ? await inflate(compressed)
          : null;
      if (!data) throw new Error(`Workbook used unsupported ZIP method ${method}`);
      entries.set(name, new TextDecoder().decode(data));
    }
    const nextCursor = cursor + 46 + fileNameLength + extraLength + commentLength;
    if (nextCursor <= cursor) throw new Error("Workbook central directory did not advance");
    cursor = nextCursor;
  }
  return entries;
}

function xmlText(value) {
  const raw = String(value).replace(/<[^>]+>/g, "");
  // decodeHtml intentionally trims page copy; spreadsheet rich-text runs need
  // their boundary whitespace preserved while they are joined.
  return decodeHtml(`x${raw}x`).slice(1, -1);
}

function sharedStrings(xml = "") {
  return [...String(xml).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(
    (match) =>
      [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
        .map((part) => xmlText(part[1]))
        .join("")
  );
}

function worksheetCells(xml, strings) {
  const cells = new Map();
  for (const match of String(xml).matchAll(
    /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi
  )) {
    const attributes = parseAttributes(match[1]);
    const reference = attributes.r;
    if (!reference) continue;
    const cellBody = match[2] ?? "";
    let value = cellBody.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? "";
    if (attributes.t === "s") value = strings[Number(value)] ?? "";
    else if (attributes.t === "inlinestr") {
      value = [...cellBody.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
        .map((part) => xmlText(part[1]))
        .join("");
    } else value = xmlText(value);
    cells.set(reference, value);
  }
  return cells;
}

function parseNhsPeriod(value) {
  const match = String(value).match(
    /^Period:\s+([A-Za-z]+)\s+(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{4})$/
  );
  if (!match) throw new Error("NHS RTT workbook did not expose the expected period");
  return {
    endMonth: MONTH_NUMBER[match[3].toLowerCase()],
    endYear: Number(match[4]),
  };
}

function excelDate(serial) {
  return new Date(Date.UTC(1899, 11, 30) + Number(serial) * DAY_MS);
}

function monthEndTimestamp(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
}

function numberCell(cells, reference) {
  const raw = String(cells.get(reference) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseNhsHistory(cells) {
  const fields = {
    medianWaitWeeks: "D",
    percentile92WaitWeeks: "E",
    within18WeeksPercent: "I",
    over52Weeks: "M",
    over65Weeks: "Q",
    over78Weeks: "S",
    over104Weeks: "U",
    waitingPathwaysEstimate: "W",
    uniquePatientsEstimate: "Y",
    admittedCompleted: "AE",
    nonAdmittedCompleted: "AK",
    newPathways: "AM",
  };
  const history = [];
  for (let row = 13; row < 500; row += 1) {
    const serial = numberCell(cells, `C${row}`);
    if (serial === null) continue;
    const hasObservation = Object.values(fields).some(
      (column) => numberCell(cells, `${column}${row}`) !== null
    );
    if (!hasObservation) continue;
    const observed = excelDate(serial);
    if (observed.getUTCFullYear() < 2016) continue;
    const point = {
      period: observed.toLocaleString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      observedAt: monthEndTimestamp(observed),
    };
    for (const [field, column] of Object.entries(fields)) {
      const raw = numberCell(cells, `${column}${row}`);
      if (raw === null) point[field] = null;
      else if (field === "within18WeeksPercent") {
        point[field] = Number((raw * 100).toFixed(1));
      } else if (["medianWaitWeeks", "percentile92WaitWeeks"].includes(field)) {
        point[field] = Number(raw.toFixed(1));
      } else point[field] = Math.round(raw);
    }
    history.push(point);
  }
  history.sort((left, right) => left.observedAt - right.observedAt);
  return history.slice(-120);
}

function annualDelta(history) {
  if (history.length < 13) {
    throw new Error("NHS RTT workbook did not expose 13 comparable months");
  }
  const latest = history.at(-1);
  const prior = history.at(-13);
  return Object.fromEntries(
    Object.keys(latest)
      .filter((key) => !["period", "observedAt"].includes(key))
      .map((key) => [
        key,
        latest[key] === null || prior[key] === null
          ? null
          : [
                "medianWaitWeeks",
                "percentile92WaitWeeks",
                "within18WeeksPercent",
              ].includes(key)
            ? Number((latest[key] - prior[key]).toFixed(1))
            : Math.round(latest[key] - prior[key]),
      ])
  );
}

async function parseNhsWorkbook(arrayBuffer) {
  const archive = await zipEntries(arrayBuffer);
  const workbook = archive.get("xl/workbook.xml") ?? "";
  const rels = archive.get("xl/_rels/workbook.xml.rels") ?? "";
  const sheet = workbook.match(
    /<sheet\b[^>]*name=(?:"|')Full Time Series(?:"|')[^>]*r:id=(?:"|')([^"']+)(?:"|')[^>]*\/?/i
  );
  if (!sheet) throw new Error("NHS RTT workbook did not expose Full Time Series");
  const relationship = [...rels.matchAll(/<Relationship\b([^>]*)\/?/gi)]
    .map((match) => parseAttributes(match[1]))
    .find((entry) => entry.id === sheet[1]);
  if (!relationship?.target) {
    throw new Error("NHS RTT workbook worksheet relationship was missing");
  }
  const target = relationship.target.replace(/\\/g, "/");
  const path = target.startsWith("/")
    ? target.slice(1)
    : target.startsWith("xl/")
      ? target
      : `xl/${target.replace(/^\.\//, "")}`;
  const xml = archive.get(path);
  if (!xml) throw new Error("NHS RTT worksheet was missing");
  const cells = worksheetCells(
    xml,
    sharedStrings(archive.get("xl/sharedStrings.xml"))
  );
  const required = {
    B2: "Title: Referral to Treatment (RTT) Waiting Times, England",
    B5: "Main Source: NHS England, monthly RTT data collection",
    B7: "Basis: Commissioner",
  };
  for (const [reference, expected] of Object.entries(required)) {
    if (decodeHtml(cells.get(reference)) !== expected) {
      throw new Error(`NHS RTT workbook ${reference} was unexpected`);
    }
  }
  const declared = parseNhsPeriod(decodeHtml(cells.get("B4")));
  const history = parseNhsHistory(cells);
  const latest = history.at(-1);
  if (!latest) throw new Error("NHS RTT workbook did not expose current history");
  const latestDate = new Date(latest.observedAt);
  if (
    latestDate.getUTCFullYear() !== declared.endYear ||
    latestDate.getUTCMonth() + 1 !== declared.endMonth
  ) {
    throw new Error("NHS RTT workbook latest month did not match its declared period");
  }
  return { history, annualDelta: annualDelta(history) };
}

function latestNhsLinks(html) {
  const links = [...String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(
    (match) => ({
      attributes: parseAttributes(match[1]),
      label: decodeHtml(match[2]),
    })
  );
  const timeseries = links.find((link) =>
    /RTT Overview Timeseries Including Estimates for Missing Trusts/i.test(
      link.label
    )
  );
  const press = links.find((link) => /RTT statistical press notice/i.test(link.label));
  if (!timeseries?.attributes.href || !press?.attributes.href) {
    throw new Error(
      "NHS RTT data page did not expose current time-series and press links"
    );
  }
  return {
    timeseriesUrl: absoluteUrl(NHS_RTT_DATA_PAGE, timeseries.attributes.href),
    pressNoticeUrl: absoluteUrl(NHS_RTT_DATA_PAGE, press.attributes.href),
  };
}

async function collectNhsRtt(fetchImpl = fetch, now = new Date()) {
  const pageResponse = await fetchResponse(NHS_RTT_DATA_PAGE, fetchImpl);
  const links = latestNhsLinks(await readResponseText(pageResponse, { label: "NHS RTT page" }));
  const [workbookResponse, pressResponse] = await Promise.all([
    fetchResponse(
      links.timeseriesUrl,
      fetchImpl,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
    ),
    fetchResponse(links.pressNoticeUrl, fetchImpl, "application/pdf"),
  ]);
  const [workbook, press] = await Promise.all([
    parseNhsWorkbook(await readResponseArrayBuffer(workbookResponse, { label: "NHS RTT workbook" })),
    extractPdfText(
      await readResponseArrayBuffer(pressResponse, {
        limit: MAX_RESPONSE_BYTES.pdf,
        label: "NHS RTT PDF",
      }),
    ).then(parseNhsRttPressNotice),
  ]);
  return normalizeNhsRttPayload(
    {
      headline: press.headline,
      specialties: press.specialties,
      missingTrusts: press.missingTrusts,
      history: workbook.history,
      annualDelta: workbook.annualDelta,
      source: {
        landingUrl:
          "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/",
        dataPageUrl: NHS_RTT_DATA_PAGE,
        pressNoticeUrl: links.pressNoticeUrl,
        timeseriesUrl: links.timeseriesUrl,
      },
    },
    now
  );
}

export {
  NHS_RTT_DATA_PAGE,
  collectNhsRtt,
  latestNhsLinks,
  parseNhsWorkbook,
  zipEntries,
};
