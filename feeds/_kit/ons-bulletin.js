/** Trailing path segment of an ONS bulletin URL, lower-cased (e.g. "september2026"). */
export function editionFromUrl(url) {
  const match = new URL(url).pathname.match(/\/([a-z0-9]+)\/?$/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Feed `collect` for an ONS bulletin feed whose section payload carries
 * `headline.{period,observedAt,releaseDate}` and `source.{bulletinUrl,edition}`.
 * Wraps the existing builder without changing what it fetches or returns:
 * `data` is exactly the section payload the builder has always produced, and
 * the builder throws on any shape, identity or reconciliation failure.
 *
 * @param {(fetchImpl: typeof fetch) => Promise<any>} build
 */
export function onsBulletinCollect(build) {
  return async function collect(ctx) {
    const data = await build(ctx.fetch);
    const { headline, source } = data;
    return {
      data,
      observation: {
        period: headline.period,
        observedAt: new Date(headline.observedAt).toISOString(),
        publishedAt: headline.releaseDate,
      },
      source: {
        url: source.bulletinUrl,
        fetchedAt: ctx.now.toISOString(),
        edition: source.edition,
      },
    };
  };
}
