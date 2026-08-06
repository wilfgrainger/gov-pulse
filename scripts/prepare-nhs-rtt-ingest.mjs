import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  discoverRttDataPageUrl,
  discoverRttPressNoticeUrl,
  discoverRttTimeseriesUrl,
  parseNhsRttPressNotice,
} from "./nhs-rtt-parser.mjs";
import { normalizeNhsRttPayload } from "../worker/nhs-rtt.js";

const LANDING_URL =
  "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/";
const USER_AGENT = "gov-pulse-source-checker/1.0";
const REQUEST_TIMEOUT_MS = 20_000;
const TIMESERIES_PARSER = fileURLToPath(
  new URL("./nhs-rtt-timeseries.py", import.meta.url)
);
const PYTHON_COMMAND =
  process.env.PYTHON_COMMAND ?? (process.platform === "win32" ? "python" : "python3");

async function fetchResponse(url, accept) {
  const response = await fetch(url, {
    headers: { Accept: accept, "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`NHS England returned ${response.status} for ${url}`);
  }
  return response;
}

async function main() {
  const landingResponse = await fetchResponse(LANDING_URL, "text/html,*/*;q=0.8");
  const landingHtml = await landingResponse.text();
  const dataPageUrl = discoverRttDataPageUrl(landingHtml, landingResponse.url || LANDING_URL);

  const dataPageResponse = await fetchResponse(dataPageUrl, "text/html,*/*;q=0.8");
  const dataPageHtml = await dataPageResponse.text();
  const pressNoticeUrl = discoverRttPressNoticeUrl(
    dataPageHtml,
    dataPageResponse.url || dataPageUrl
  );
  const timeseriesUrl = discoverRttTimeseriesUrl(
    dataPageHtml,
    dataPageResponse.url || dataPageUrl
  );

  const directory = await mkdtemp(join(tmpdir(), "pulse-nhs-rtt-"));
  const pdfPath = join(directory, "press-notice.pdf");
  const textPath = join(directory, "press-notice.txt");
  const workbookPath = join(directory, "rtt-timeseries.xlsx");

  try {
    const pdfResponse = await fetchResponse(pressNoticeUrl, "application/pdf,*/*;q=0.8");
    const contentType = pdfResponse.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/pdf")) {
      throw new Error(`NHS RTT press notice did not return PDF content (${contentType || "unknown"})`);
    }
    await writeFile(pdfPath, Buffer.from(await pdfResponse.arrayBuffer()));
    const workbookResponse = await fetchResponse(
      timeseriesUrl,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.8"
    );
    const workbookContentType = (
      workbookResponse.headers.get("content-type") ?? ""
    ).toLowerCase();
    if (
      !workbookContentType.includes(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) &&
      !workbookContentType.includes("application/octet-stream")
    ) {
      throw new Error(
        `NHS RTT time-series workbook returned unexpected content (${workbookContentType || "unknown"})`
      );
    }
    const workbookBuffer = Buffer.from(await workbookResponse.arrayBuffer());
    if (workbookBuffer.length < 4 || workbookBuffer.subarray(0, 2).toString("ascii") !== "PK") {
      throw new Error("NHS RTT time-series workbook was not a valid XLSX container");
    }
    await writeFile(workbookPath, workbookBuffer);

    const lookup = spawnSync(process.platform === "win32" ? "where" : "which", ["pdftotext"], { encoding: "utf8" });
    if (lookup.status !== 0) {
      console.warn("WARNING: 'pdftotext' (poppler-utils) is not installed on this system. Falling back to cached seed data.");
      process.exit(0);
    }

    const conversion = spawnSync("pdftotext", ["-layout", pdfPath, textPath], {
      encoding: "utf8",
      timeout: 30_000,
    });
    if (conversion.error) throw conversion.error;
    if (conversion.status !== 0) {
      throw new Error(
        `pdftotext failed with status ${conversion.status}: ${conversion.stderr || "no diagnostics"}`
      );
    }

    const text = await readFile(textPath, "utf8");
    const timeseries = spawnSync(
      PYTHON_COMMAND,
      [TIMESERIES_PARSER, workbookPath],
      { encoding: "utf8", timeout: 30_000 }
    );
    if (timeseries.error) throw timeseries.error;
    if (timeseries.status !== 0) {
      throw new Error(
        `NHS RTT time-series extraction failed with status ${timeseries.status}: ${
          timeseries.stderr || "no diagnostics"
        }`
      );
    }
    const history = JSON.parse(timeseries.stdout);
    const parsed = parseNhsRttPressNotice(text, {
      landingUrl: LANDING_URL,
      dataPageUrl,
      pressNoticeUrl: pdfResponse.url || pressNoticeUrl,
    });
    parsed.history = history.history;
    parsed.annualDelta = history.annualDelta;
    parsed.source.timeseriesUrl = workbookResponse.url || timeseriesUrl;
    const data = normalizeNhsRttPayload(parsed);

    process.stdout.write(
      JSON.stringify(
        {
          section: "nhsStats",
          data,
          fetchedAt: `${data.headline.publicationDate}T12:00:00.000Z`,
          sourceLabel: "NHS England RTT statistical press notice",
          backend: "scheduled-nhs-ingest",
        },
        null,
        2
      )
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
