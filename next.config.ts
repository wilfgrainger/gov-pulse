import type { NextConfig } from "next";

const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "")
  .trim()
  .replace(/\/+$/, "");
const basePath = configuredBasePath && !configuredBasePath.startsWith("/")
  ? `/${configuredBasePath}`
  : configuredBasePath;
const staticExport = process.env.STATIC_EXPORT === "true";

// Mirrors public/_headers, which Cloudflare applies only to static assets. Next-rendered
// HTML is served by the web Worker and needs the same protections on every response.
export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

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
