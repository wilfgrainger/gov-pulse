import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapWords(value, maximum = 31) {
  const words = value.trim().split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maximum && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function socialCard(section) {
  const titleLines = wrapWords(section.title);
  const title = titleLines
    .map(
      (line, index) =>
        `<tspan x="72" dy="${index === 0 ? 0 : 76}">${escapeXml(line)}</tspan>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(section.title)}">
  <rect width="1200" height="630" fill="#0c0f12"/>
  <rect x="0" y="0" width="1200" height="8" fill="#e8352e"/>
  <rect x="72" y="88" width="72" height="3" fill="#e8352e"/>
  <text x="72" y="140" fill="#9aa3ad" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="700" letter-spacing="3">${escapeXml(section.category.toUpperCase())} · UK PUBLIC EVIDENCE</text>
  <text x="72" y="270" fill="#ebe6dc" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="700">${title}</text>
  <text x="72" y="548" fill="#9aa3ad" font-family="Arial, Helvetica, sans-serif" font-size="28">Clear dates · named sources · material caveats</text>
  <text x="1128" y="590" text-anchor="end" fill="#ebe6dc" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">public-data<tspan fill="#e8352e">.org</tspan></text>
</svg>
`;
}

async function main() {
  const contractPath = resolve(projectRoot, "contracts/section-discovery.json");
  const outputDirectory = resolve(projectRoot, "public/social");
  const contract = JSON.parse(await readFile(contractPath, "utf8"));

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    Object.entries(contract.sections).map(([id, section]) =>
      writeFile(resolve(outputDirectory, `${id}.svg`), socialCard(section), "utf8")
    )
  );

  await writeFile(
    resolve(outputDirectory, "home.svg"),
    socialCard({ title: "Britain, in evidence", category: "Independent" }),
    "utf8"
  );

  process.stdout.write(
    `Generated ${Object.keys(contract.sections).length + 1} deterministic social cards\n`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
