import type { NextConfig } from "next";
import { securityHeaders } from "./contracts/security-headers.js";

const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "")
  .trim()
  .replace(/\/+$/, "");
const basePath = configuredBasePath && !configuredBasePath.startsWith("/")
  ? `/${configuredBasePath}`
  : configuredBasePath;
const staticExport = process.env.STATIC_EXPORT === "true";

// The shared set lives in contracts/security-headers.js (also mirrored by public/_headers).
export { securityHeaders };

const deliveryMode: Partial<NextConfig> = staticExport
  ? { output: "export" as const }
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
