import type { NextConfig } from "next";

const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "")
  .trim()
  .replace(/\/+$/, "");
const basePath = configuredBasePath && !configuredBasePath.startsWith("/")
  ? `/${configuredBasePath}`
  : configuredBasePath;
const staticExport = process.env.STATIC_EXPORT === "true";

const deliveryMode: Partial<NextConfig> = staticExport
  ? { output: "export" as const }
  : {
      async headers() {
        return [
          {
            source: "/:path*",
            has: [
              {
                type: "header" as const,
                key: "accept",
                value: ".*text/html.*",
              },
            ],
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
  // Server mode is used for the request-time Cloudflare Worker. The bounded
  // Pages seed still uses a deterministic static export.
  ...deliveryMode,
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
