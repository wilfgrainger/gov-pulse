// The feed list: one guarded line per feed. A test fails if a feeds/<slug>
// folder is missing here or listed twice. Adding a feed here does not publish
// it: publication state lives only in config/publications.json.
import { definition as electionPollingDefinition } from "./election-polls/feed.js";
import * as electionPollingParser from "./election-polls/parse.js";
import { definition as nationalDebtDefinition } from "./national-debt/feed.js";
import * as nationalDebtParser from "./national-debt/parse.js";
import { definition as gdpTrackerDefinition } from "./gdp/feed.js";
import * as gdpTrackerParser from "./gdp/parse.js";
import { definition as sentimentPulseDefinition } from "./economy/feed.js";
import * as sentimentPulseParser from "./economy/parse.js";
import { definition as taxRevenueDefinition } from "./tax/feed.js";
import * as taxRevenueParser from "./tax/parse.js";
import { definition as employmentStatsDefinition } from "./employment/feed.js";
import * as employmentStatsParser from "./employment/parse.js";
import { definition as crimeStatisticsDefinition } from "./crime-stats/feed.js";
import * as crimeStatisticsParser from "./crime-stats/parse.js";
import { definition as nhsStatsDefinition } from "./nhs/feed.js";
import * as nhsStatsParser from "./nhs/parse.js";
import { definition as migrationStatsDefinition } from "./migration/feed.js";
import * as migrationStatsParser from "./migration/parse.js";
import { definition as housePriceIndexDefinition } from "./house-price-index/feed.js";
import * as housePriceIndexParser from "./house-price-index/parse.js";
import { definition as realWagesDefinition } from "./real-wages/feed.js";
import * as realWagesParser from "./real-wages/parse.js";
import { definition as bettingOddsDefinition } from "./betting-odds/feed.js";
import * as bettingOddsParser from "./betting-odds/parse.js";
import { definition as governmentContractsDefinition } from "./government-contracts/feed.js";
import * as governmentContractsParser from "./government-contracts/parse.js";
import { definition as releaseCalendarDefinition } from "./release-calendar/feed.js";
import * as releaseCalendarParser from "./release-calendar/parse.js";
import { definition as nhsReleaseCalendarDefinition } from "./nhs-release-calendar/feed.js";
import * as nhsReleaseCalendarParser from "./nhs-release-calendar/parse.js";
import { definition as internationalComparisonDefinition } from "./international-comparison/feed.js";
import * as internationalComparisonParser from "./international-comparison/parse.js";
import { definition as earlyYearsDefinition } from "./early-years/feed.js";

/**
 * `collect` is absent only for static feeds (no collector) and sharded feeds,
 * which declare `collectShard` and `combine` instead.
 * @typedef {{definition: Readonly<Record<string, any>>, collect?: (ctx: any) => Promise<any>,
 *   collectShard?: (ctx: any, shardKey: string) => Promise<object>,
 *   combine?: (shards: Record<string, object>, ctx: any) => any}} FeedModule
 */

/** @type {readonly FeedModule[]} */
export const FEEDS = Object.freeze([
  { definition: electionPollingDefinition, collect: electionPollingParser.collect },
  { definition: nationalDebtDefinition, collect: nationalDebtParser.collect },
  { definition: gdpTrackerDefinition, collect: gdpTrackerParser.collect },
  { definition: sentimentPulseDefinition, collect: sentimentPulseParser.collect },
  { definition: taxRevenueDefinition, collect: taxRevenueParser.collect },
  { definition: employmentStatsDefinition, collect: employmentStatsParser.collect },
  { definition: crimeStatisticsDefinition, collect: crimeStatisticsParser.collect },
  { definition: nhsStatsDefinition, collect: nhsStatsParser.collect },
  { definition: migrationStatsDefinition, collect: migrationStatsParser.collect },
  { definition: housePriceIndexDefinition, collect: housePriceIndexParser.collect },
  { definition: realWagesDefinition, collect: realWagesParser.collect },
  { definition: bettingOddsDefinition, collect: bettingOddsParser.collect },
  { definition: governmentContractsDefinition, collectShard: governmentContractsParser.collectShard, combine: governmentContractsParser.combine },
  { definition: releaseCalendarDefinition, collect: releaseCalendarParser.collect },
  { definition: nhsReleaseCalendarDefinition, collect: nhsReleaseCalendarParser.collect },
  { definition: internationalComparisonDefinition, collectShard: internationalComparisonParser.collectShard, combine: internationalComparisonParser.combine },
  { definition: earlyYearsDefinition },
]);
