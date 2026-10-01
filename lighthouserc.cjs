module.exports = {
  ci: {
    collect: {
      // Local build+serve preview only — no deployed PR preview URL is
      // available from this CI environment (Cloudflare deploy happens on
      // main, not on PRs). See .github/workflows/pr-validation.yml.
      startServerCommand: "npm run start -- --port 4173",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 60000,
      url: ["http://127.0.0.1:4173/"],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        chromeFlags: "--no-sandbox --headless=new",
      },
    },
    assert: {
      // Non-blocking on first introduction: there is no historical baseline
      // yet, and a hard-fail gate here could block unrelated PRs. Report
      // scores via the uploaded summary; tighten this to `assertMatrix`
      // failure-level assertions once a few weeks of readings exist.
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.8 }],
        "categories:best-practices": ["warn", { minScore: 0.8 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
