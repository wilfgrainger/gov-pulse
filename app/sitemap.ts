import type { MetadataRoute } from "next";
import {
  PUBLIC_SECTION_IDS,
  SECTION_DISCOVERY,
  absoluteUrl,
  getBuildPublication,
  sectionPath,
} from "@/app/lib/discovery";

export const dynamic = "force-static";
export const revalidate = false;

function validDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/sources/"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/feed.xml"),
      changeFrequency: "daily",
      priority: 0.5,
    },
  ];

  const sectionRoutes: MetadataRoute.Sitemap = PUBLIC_SECTION_IDS.map((id) => {
    const publication = getBuildPublication(SECTION_DISCOVERY[id]);
    return {
      url: absoluteUrl(sectionPath(id)),
      lastModified: validDate(publication?.dateModified),
      changeFrequency: SECTION_DISCOVERY[id].kind === "dataset" ? "daily" : "monthly",
      priority: SECTION_DISCOVERY[id].kind === "dataset" ? 0.8 : 0.5,
    };
  });

  return [...staticRoutes, ...sectionRoutes];
}
