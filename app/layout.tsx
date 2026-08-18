import type { Metadata } from "next";
import localFont from "next/font/local";
import { serializeJsonLd, SITE_DISCOVERY } from "@/app/lib/discovery";
import { MetricsSnapshotProvider } from "@/app/lib/MetricsSnapshotProvider";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { BRAND_NAME, SITE_DESCRIPTION, SITE_SOCIAL_DESCRIPTION, SITE_TITLE } from "@/app/lib/siteCopy";
import "./globals.css";

const bodyFont = localFont({
  src: "../public/fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_DISCOVERY.origin),
  title: {
    default: SITE_TITLE,
    template: `%s | ${BRAND_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/feed.xml" },
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_SOCIAL_DESCRIPTION,
    type: "website",
    siteName: BRAND_NAME,
    url: "/",
    images: [
      {
        url: "/social/home.svg",
        width: 1200,
        height: 630,
        alt: "Britain, in evidence — public-data.org",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_SOCIAL_DESCRIPTION,
    images: ["/social/home.svg"],
  },
  other: {
    "public-data-revision": process.env.NEXT_PUBLIC_COMMIT_SHA ?? "local",
  },
};

const publicationStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_DISCOVERY.origin}/#organization`,
      name: SITE_DISCOVERY.name,
      url: SITE_DISCOVERY.origin,
      description: SITE_DISCOVERY.description,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_DISCOVERY.origin}/#website`,
      name: SITE_DISCOVERY.name,
      url: SITE_DISCOVERY.origin,
      description: SITE_DISCOVERY.description,
      publisher: { "@id": `${SITE_DISCOVERY.origin}/#organization` },
      inLanguage: "en-GB",
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialSnapshot = await readServerMetricsSnapshot();

  return (
    <html lang="en" className={bodyFont.variable} data-scroll-behavior="smooth">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(publicationStructuredData) }}
        />
        <MetricsSnapshotProvider snapshot={initialSnapshot}>
          {children}
        </MetricsSnapshotProvider>
      </body>
    </html>
  );
}
