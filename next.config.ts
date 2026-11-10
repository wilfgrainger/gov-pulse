import type { NextConfig } from "next";
import { securityHeaders } from "./contracts/security-headers.js";

const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "")
  .trim()
  .replace(/\/+$/, "");
const basePath = configuredBasePath && !configuredBasePath.startsWith("/")
  ? `/${configuredBasePath}`
  : configuredBasePath;
// EDITION_BUILD=1 is the per-edition static build (scripts/build-edition-site.mjs,
// which also sets STATIC_EXPORT=true for the pages); STATIC_EXPORT alone is the Pages seed.
const editionBuild = process.env.EDITION_BUILD === "1";
const staticExport = process.env.STATIC_EXPORT === "true" || editionBuild;

// The shared set lives in contracts/security-headers.js (also mirrored by public/_headers).
export { securityHeaders };

const deliveryMode: Partial<NextConfig> = staticExport
  ? {
      output: "export" as const,
      // Both edition variants share one build id, so client navigation between an
      // available page and its unavailable variant stays on one build.
      ...(editionBuild && process.env.EDITION_BUILD_ID
        ? { generateBuildId: async () => process.env.EDITION_BUILD_ID as string }
        : {}),
    }
  : {
      async headers() {
        return [
          { source: "/:path*", headers: securityHeaders },
          {
            // Every Next-rendered response (HTML, RSC payloads, feeds), whatever
            // the Accept header: prerendered held notices otherwise go out with
            // a year-long s-maxage. Hashed /_next/ assets carry no evidence.
            source: "/((?!_next/).*)",
            headers: [
              {
                key: "Cache-Control",
                value: "public, max-age=0, must-revalidate, no-transform",
              },
            ],
          },
        ];
      },
    };

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Server mode is used for the request-time Cloudflare Worker. The bounded
  // Pages seed still uses a deterministic static export.
  ...deliveryMode,
  agentRules: false,
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
