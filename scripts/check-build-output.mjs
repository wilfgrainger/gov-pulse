import { access, readFile, writeFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";

execFileSync(process.execPath, ["scripts/generate-section-downloads.mjs", "--optional-missing"], {
  env: process.env,
  stdio: "inherit",
});

execFileSync(process.execPath, ["scripts/generate-social-cards.mjs"], {
  env: process.env,
  stdio: "inherit",
});

const child = spawn("npm run build", {
  env: process.env,
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
});

let output = "";

for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    output += chunk.toString();
  });
}

const exitCode = await new Promise((resolve) => {
  child.on("close", resolve);
});

await writeFile("build-output.log", output, "utf8");

function printDiagnosticTail() {
  const lines = output.trimEnd().split("\n");
  process.stdout.write(`${lines.slice(-100).join("\n")}\n`);
}

if (exitCode !== 0) {
  printDiagnosticTail();
  process.exit(exitCode ?? 1);
}

if (/width\(-1\)|height\(-1\)|The width\(-1\)/.test(output)) {
  printDiagnosticTail();
  console.error("Build emitted Recharts sizing warnings.");
  process.exit(1);
}

if (process.env.STATIC_EXPORT === "true") {
  const requiredPagesArtifacts = [
    "out/index.html",
    "out/sources/index.html",
    "out/about/index.html",
    "out/editorial-policy/index.html",
    "out/independence/index.html",
    "out/contact/index.html",
    "out/corrections/index.html",
    "out/section/gdp/index.html",
    "out/sitemap.xml",
    "out/robots.txt",
    "out/feed.xml",
    "out/social/home.svg",
    "out/social/gdp.svg",
  ];

  for (const artifact of requiredPagesArtifacts) {
    try {
      await access(artifact);
    } catch (error) {
      printDiagnosticTail();
      console.error(`Static export did not create required Pages artifact: ${artifact}`, error);
      process.exit(1);
    }
  }

  const gdpHtml = await readFile("out/section/gdp/index.html", "utf8");
  const expectedMarkers = [
    "<title>UK GDP growth | public-data.org</title>",
    'rel="canonical" href="https://public-data.org/section/gdp/"',
    'type="application/ld+json"',
    '"@type":"Dataset"',
    'href="https://public-data.org/feed.xml"',
    'href="/data/sections/gdpTracker.json"',
    'href="/data/sections/gdpTracker.csv"',
  ];

  for (const marker of expectedMarkers) {
    if (!gdpHtml.includes(marker)) {
      printDiagnosticTail();
      console.error(`GDP static HTML is missing discovery marker: ${marker}`);
      process.exit(1);
    }
  }
}

printDiagnosticTail();
