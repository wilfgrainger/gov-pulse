import {
  buildCurrentCrimeStatisticsPayload,
  isCurrentCrimeStatisticsPayload,
  normalizeCrimeStatisticsPayload,
} from "../contracts/crime-statistics.js";
import { collectCrimeStatistics } from "./live-crime-collector.js";

async function buildCrimeStatistics(now = new Date(), fetchImpl = fetch) {
  return collectCrimeStatistics(fetchImpl, now);
}

export {
  buildCrimeStatistics,
  buildCurrentCrimeStatisticsPayload,
  isCurrentCrimeStatisticsPayload,
  normalizeCrimeStatisticsPayload,
};
