import { SOURCE_CATALOG } from "../contracts/source-catalog.js";

// The single host allowlist for collector retrieval. Every request a collector
// sends, and every redirect hop it follows, must land on one of these hosts.
//
// Primary publisher hosts are derived from contracts/source-catalog.js (the
// owner of every source's primaryUrls, which worker/feed-registry.js projects),
// so adding a source there approves its host here without a second list.
//
// The supplementary sets below are retrieval hosts that are not a catalog
// primary URL but which collectors legitimately query or discover. Collectors
// that pin scraped links import these same sets rather than declaring their own.

// YouGov voting-intention articles are linked from the catalog index page on
// yougov.com; some article links use the www. form.
export const YOU_GOV_ARTICLE_HOSTS = frozenHostSet(["yougov.com", "www.yougov.com"]);

// YouGov hosts its primary result-table PDFs on its editorial asset CDN, which
// articles link to directly (feeds/election-polls/parse.js findPdfUrl).
export const YOU_GOV_RESULTS_HOSTS = frozenHostSet([
  "ygo-assets-websites-editorial-emea.yougov.net",
]);

// NHS England pages and workbook links are published under both the apex and
// www. hosts (feeds/nhs/source-discovery.js and feeds/nhs/rtt.js).
export const NHS_ENGLAND_HOSTS = frozenHostSet(["www.england.nhs.uk", "england.nhs.uk"]);

const SUPPLEMENTARY_RETRIEVAL_HOSTS = Object.freeze({
  // The OECD catalog primary URL is the human-facing Data Explorer; the
  // machine-readable SDMX REST API it presents is served from sdmx.oecd.org
  // (feeds/international-comparison/sources.js OECD_SDMX).
  "sdmx.oecd.org": "OECD SDMX REST API behind data-explorer.oecd.org",
});

function frozenHostSet(hosts) {
  const set = new Set(hosts.map((host) => String(host).toLowerCase()));
  const refuse = () => {
    throw new TypeError("Approved source host sets are immutable");
  };
  Object.defineProperties(set, {
    add: { value: refuse },
    delete: { value: refuse },
    clear: { value: refuse },
  });
  return Object.freeze(set);
}

function catalogPrimaryHosts() {
  return Object.values(SOURCE_CATALOG).flatMap((source) =>
    source.primaryUrls.map((url) => new URL(url).hostname.toLowerCase())
  );
}

export const APPROVED_SOURCE_HOSTS = frozenHostSet([
  ...catalogPrimaryHosts(),
  ...YOU_GOV_ARTICLE_HOSTS,
  ...YOU_GOV_RESULTS_HOSTS,
  ...NHS_ENGLAND_HOSTS,
  ...Object.keys(SUPPLEMENTARY_RETRIEVAL_HOSTS),
]);

export { frozenHostSet };
