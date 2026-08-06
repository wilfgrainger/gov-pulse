import { defineConfig, devices } from "@playwright/test";

const testPort = Number(process.env.PLAYWRIGHT_PORT ?? "4173");
const localBaseURL = `http://127.0.0.1:${testPort}`;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? localBaseURL;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: `npx next dev -H 127.0.0.1 -p ${testPort}`,
        url: localBaseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
