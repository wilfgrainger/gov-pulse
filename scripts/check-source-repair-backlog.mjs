import fs from "node:fs";
import process from "node:process";

const BACKLOG_PATH = "docs/source-repair-backlog.md";
const content = fs.readFileSync(BACKLOG_PATH, "utf8");
const sections = content
  .split(/\n(?=## )/)
  .filter((section) => /^## /m.test(section));

const requirements = [
  ["linked issue", /(?:Issue|Issue link):\s*#\d+/i],
  ["implementation PR", /(?:PR|Implementation PR):\s*#\d+/i],
  ["exact 40-character commit SHA", /(?:Commit|Validated commit):\s*`?[0-9a-f]{40}`?/i],
  ["GitHub Actions run", /(?:CI|Validation run):\s*https:\/\/github\.com\/[^\s]+\/actions\/runs\/\d+/i],
  ["production verification date", /Production verification:\s*\d{4}-\d{2}-\d{2}/i],
];

const failures = [];
for (const section of sections) {
  if (!/\bRESOLVED\b/i.test(section)) continue;
  const heading = section.split("\n", 1)[0];
  for (const [label, pattern] of requirements) {
    if (!pattern.test(section)) failures.push(`${heading}: missing ${label}`);
  }
}

if (failures.length > 0) {
  console.error("Resolved source-repair entries require executable delivery evidence:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Source-repair backlog status evidence is valid.");
