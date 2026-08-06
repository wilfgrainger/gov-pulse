import { readFile } from "node:fs/promises";
import { normalizePrimaryPollPayload } from "../worker/election-polls.js";

const sourcePath = new URL("../data/election-polls/primary-polls.json", import.meta.url);
const raw = JSON.parse(await readFile(sourcePath, "utf8"));
const data = normalizePrimaryPollPayload(raw);

process.stdout.write(
  JSON.stringify(
    {
      section: "electionPolling",
      data,
      fetchedAt: `${data.latestPublicationDate}T12:00:00.000Z`,
      sourceLabel: "Verified primary pollster publications",
      backend: "scheduled-election-poll-ingest",
    },
    null,
    2
  )
);
