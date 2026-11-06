// The feed list: one guarded line per feed. A test fails if a feeds/<slug>
// folder is missing here or listed twice. Adding a feed here does not publish
// it: publication state lives only in config/publications.json.
import { definition as housePriceIndexDefinition } from "./house-price-index/feed.js";
import * as housePriceIndexParser from "./house-price-index/parse.js";
import { definition as realWagesDefinition } from "./real-wages/feed.js";
import * as realWagesParser from "./real-wages/parse.js";
import { definition as migrationStatsDefinition } from "./migration/feed.js";
import * as migrationStatsParser from "./migration/parse.js";
import { definition as nhsStatsDefinition } from "./nhs/feed.js";
import * as nhsStatsParser from "./nhs/parse.js";
import { definition as crimeStatisticsDefinition } from "./crime-stats/feed.js";
import * as crimeStatisticsParser from "./crime-stats/parse.js";

/**
 * @typedef {{definition: Readonly<Record<string, any>>, collect: (ctx: any) => Promise<any>,
 *   collectShard?: (ctx: any, shardKey: string) => Promise<object>,
 *   combine?: (shards: Record<string, object>, ctx: any) => any}} FeedModule
 */

/** @type {readonly FeedModule[]} */
export const FEEDS = Object.freeze([
  { definition: crimeStatisticsDefinition, collect: crimeStatisticsParser.collect },
  { definition: nhsStatsDefinition, collect: nhsStatsParser.collect },
  { definition: migrationStatsDefinition, collect: migrationStatsParser.collect },
  { definition: housePriceIndexDefinition, collect: housePriceIndexParser.collect },
  { definition: realWagesDefinition, collect: realWagesParser.collect },
]);
