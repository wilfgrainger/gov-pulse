import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { publicationEnabled } from "../contracts/publication-policy.js";

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
  execFileSync(process.execPath, ["scripts/generate-section-downloads.mjs", "--optional-missing"], {
    env: process.env,
    stdio: "inherit",
  });

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

  const sectionAssets = await readdir("out/data/sections").catch((error) => {
    if (error && typeof error === "object" && error.code === "ENOENT") return [];
    throw error;
  });
  for (const asset of sectionAssets.filter((file) => /\.(json|csv)$/.test(file))) {
    const section = asset.replace(/\.(json|csv)$/, "");
    if (!publicationEnabled(section)) {
      printDiagnosticTail();
      console.error(`Static export contains a disabled or unknown section download: ${asset}`);
      process.exit(1);
    }
  }

  async function checkSectionDownloads({ route, section, title }) {
    const html = await readFile(`out/section/${route}/index.html`, "utf8");
    const formats = ["json", "csv"];
    const links = formats.map((format) => `href="/data/sections/${section}.${format}"`);
    const hasAnyLink = links.some((marker) => html.includes(marker));
    const hasAllLinks = links.every((marker) => html.includes(marker));
    const hasCompleteDownloads = hasAllLinks && html.includes(
      "Source metadata, observation and publication dates, geography, attribution and licence are included with this current edition."
    );

    if (hasCompleteDownloads) {
      for (const format of formats) {
        const artifact = `out/data/sections/${section}.${format}`;
        try {
          await access(artifact);
        } catch (error) {
          printDiagnosticTail();
          console.error(`${title} static HTML links to a missing section download: ${artifact}`, error);
          process.exit(1);
        }
      }
      return;
    }

    if (hasAnyLink || !html.includes("A download will appear when this section has current verified evidence.")) {
      printDiagnosticTail();
      console.error(`${title} static HTML must show both verified downloads or an explicit unavailable state.`);
      process.exit(1);
    }
    for (const format of formats) {
      const artifact = `out/data/sections/${section}.${format}`;
      try {
        await access(artifact);
        printDiagnosticTail();
        console.error(`${title} has a download artifact while its HTML shows no verified evidence: ${artifact}`);
        process.exit(1);
      } catch (error) {
        if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
      }
    }
  }

  const gdpHtml = await readFile("out/section/gdp/index.html", "utf8");
  if (publicationEnabled("gdpTracker")) {
    const requiredDiscoveryMarkers = [
      "<title>UK GDP growth | public-data.org</title>",
      'rel="canonical" href="https://public-data.org/section/gdp/"',
      'type="application/ld+json"',
      '"@type":"Dataset"',
      'href="https://public-data.org/feed.xml"',
    ];
    for (const marker of requiredDiscoveryMarkers) {
      if (!gdpHtml.includes(marker)) {
        printDiagnosticTail();
        console.error(`GDP static HTML is missing discovery marker: ${marker}`);
        process.exit(1);
      }
    }
    await checkSectionDownloads({ route: "gdp", section: "gdpTracker", title: "GDP" });
  } else {
    if (!gdpHtml.includes("This topic is part of the publication") || !gdpHtml.includes("source data is held from public release") || /href="\/data\/sections\/gdpTracker\.(json|csv)"/.test(gdpHtml)) {
      printDiagnosticTail();
      console.error("Held GDP static HTML must explain the publication hold without exposing downloads.");
      process.exit(1);
    }
    for (const extension of ["json", "csv"]) {
      const artifact = `out/data/sections/gdpTracker.${extension}`;
      try {
        await access(artifact);
        printDiagnosticTail();
        console.error(`Held GDP data must not be emitted as a static asset: ${artifact}`);
        process.exit(1);
      } catch (error) {
        if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
      }
    }
  }

  if (publicationEnabled("nationalDebt")) {
    await checkSectionDownloads({ route: "national-debt", section: "nationalDebt", title: "National debt" });
  }
}

printDiagnosticTail();
