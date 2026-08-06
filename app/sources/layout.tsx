import type { Metadata } from "next";

const title = "Sources and methods";
const description =
  "Audit the official publications, evidence classes, update rules, caveats and documented gaps behind public-data.org.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/sources/",
    types: { "application/rss+xml": "/feed.xml" },
  },
  openGraph: {
    title,
    description,
    type: "website",
    url: "/sources/",
    images: [
      {
        url: "/social/home.svg",
        width: 1200,
        height: 630,
        alt: "Sources and methods — public-data.org",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/social/home.svg"],
  },
};

export default function SourcesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
