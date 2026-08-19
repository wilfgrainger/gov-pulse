import { collectInternationalComparison } from '../worker/international-comparison-publication.js';
import { buildMigrationStats } from '../worker/migration.js';

const publication = await collectInternationalComparison(fetch, new Date());
const status = publication.meta.sourceStatus;
console.log('LIVE_COMPARISON_STATUS', JSON.stringify(status));

for (const [id, measure] of Object.entries(publication.measures)) {
  const uk = measure.countries.find((entry) => entry.country === 'GBR');
  console.log(
    'LIVE_COMPARISON_MEASURE',
    JSON.stringify({
      id,
      comparableCountryCount: measure.comparableCountryCount,
      ukValue: uk?.value ?? null,
      ukRank: uk?.rank ?? null,
      year: uk?.observationYear ?? measure.observationYear,
      valueType: uk?.valueType ?? null,
      exclusionReason: uk?.exclusionReason ?? null,
    })
  );
}

const required = [
  'governmentDebt',
  'officialDevelopmentAssistance',
  'defenceSpending',
  'publicSocialExpenditure',
  'healthcareSpending',
  'taxRevenue',
  'debtInterest',
];
const unavailable = required.filter((id) => status[id] !== 'available');
if (unavailable.length > 0) {
  throw new Error(`Comparison sources still unavailable: ${unavailable.join(', ')}`);
}

const migration = await buildMigrationStats(fetch);
console.log('LIVE_MIGRATION', JSON.stringify(migration.headline));
if (!Number.isFinite(migration?.headline?.netMigration)) {
  throw new Error('Live ONS migration collector did not produce a headline');
}
