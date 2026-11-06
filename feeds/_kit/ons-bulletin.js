/** Trailing path segment of an ONS bulletin URL, lower-cased (e.g. "september2026"). */
export function editionFromUrl(url) {
  const match = new URL(url).pathname.match(/\/([a-z0-9]+)\/?$/i);
  return match ? match[1].toLowerCase() : null;
}
