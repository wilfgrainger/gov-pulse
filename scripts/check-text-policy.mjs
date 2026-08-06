import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const TEXT_FILENAMES = new Set([
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  "Dockerfile",
]);
const mojibake = (...codePoints) => String.fromCodePoint(...codePoints);
const MOJIBAKE_PATTERNS = [
  mojibake(0x00c2, 0x00b7),
  mojibake(0x00c2, 0x00a3),
  mojibake(0x00c2, 0x00a9),
  mojibake(0x00e2, 0x20ac, 0x2122),
  mojibake(0x00e2, 0x20ac, 0x0153),
  mojibake(0x00e2, 0x20ac, 0x009d),
  mojibake(0x00e2, 0x20ac, 0x201c),
  mojibake(0x00e2, 0x20ac, 0x201d),
  mojibake(0x00ef, 0x00bb, 0x00bf),
  mojibake(0xfffd),
];
const decoder = new TextDecoder("utf-8", { fatal: true });

function gitFiles() {
  const changedOnly = process.argv.includes("--changed");
  let args;
  if (changedOnly) {
    const base = process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : "HEAD^";
    try {
      args = ["diff", "--name-only", "--diff-filter=ACMR", "-z", `${base}...HEAD`];
      return execFileSync("git", args).toString("utf8").split("\0").filter(Boolean);
    } catch {
      args = ["diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD^"];
      return execFileSync("git", args).toString("utf8").split("\0").filter(Boolean);
    }
  }
  return execFileSync("git", ["ls-files", "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function isGovernedTextFile(file) {
  const basename = path.basename(file);
  return TEXT_FILENAMES.has(basename) || TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

const failures = [];
for (const file of gitFiles().filter(isGovernedTextFile)) {
  if (!fs.existsSync(file)) continue;
  const bytes = fs.readFileSync(file);
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    failures.push(`${file}: is not valid UTF-8`);
    continue;
  }
  if (text.includes("\r\n")) failures.push(`${file}: contains CRLF line endings`);
  if (text.includes("\r") && !text.includes("\r\n")) {
    failures.push(`${file}: contains bare carriage returns`);
  }
  for (const pattern of MOJIBAKE_PATTERNS) {
    if (text.includes(pattern)) failures.push(`${file}: contains suspected mojibake '${pattern}'`);
  }
}

if (failures.length > 0) {
  console.error("Text policy violations:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Changed governed text files are valid UTF-8 with LF line endings and no known mojibake.");
