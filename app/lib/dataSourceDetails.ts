import {
  FEED_CATALOG,
  legacyDataSourceDetail,
} from "@/contracts/source-catalog.js";

export interface DataSourceDetail {
  publicationPeriod: string;
  unit: string;
  revisionStatus: string;
  caveat: string;
}

export const DATA_SOURCE_DETAILS = Object.freeze(Object.fromEntries(
  Object.values(FEED_CATALOG)
    .filter((feed) => Boolean(feed.editorial))
    .map((feed) => [
      feed.id,
      legacyDataSourceDetail(feed.id) as DataSourceDetail,
    ])
)) as Readonly<Record<string, DataSourceDetail>>;
