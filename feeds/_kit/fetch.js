import { fetchOfficialResponse } from "../../worker/official-source-fetch.js";
import { readResponseText } from "../../worker/response-limits.js";

/**
 * Bounded retrieval of one approved HTTPS source as text. Host approval,
 * redirect checks and size limits come from the existing worker modules.
 */
export async function fetchOfficialText(url, { accept, label, sourceName = "ONS", fetchImpl = fetch }) {
  const response = await fetchOfficialResponse(url, { accept, fetchImpl, sourceName });
  return {
    text: await readResponseText(response, { label }),
    finalUrl: response.url || url,
  };
}
