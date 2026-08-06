# Political betting market evidence audit — 14 July 2026

## Scope

PULSE carries three time-sensitive commercial market signals:

1. Next Prime Minister after Keir Starmer.
2. Most seats at the next UK general election.
3. Year of the next UK general election.

These are not official statistics, polls or forecasts. They are public Oddschecker market snapshots that can change within minutes.

## Previous integrity failures

The previous implementation:

- retained political betting prices in the shared frontend fallback;
- allowed a `stale` Worker cache state to render;
- collapsed market runners into a synthetic `Other` row;
- normalized reciprocal prices to sum to 100%;
- enriched candidates with hardcoded party and role descriptions that could become obsolete;
- stored the loose legacy shape in the same generic section cache used by earlier releases;
- exposed no exact market identity or direct URL in the public payload;
- verified endpoint availability but not the strict evidence shape or health record.

## Accepted markets

| Contract ID | Public market | Direct source |
| --- | --- | --- |
| `nextPrimeMinister` | Next Prime Minister after Keir Starmer | `https://www.oddschecker.com/politics/british-politics/next-prime-minister-after-keir-starmer` |
| `mostSeats` | Most seats at the next UK general election | `https://www.oddschecker.com/politics/british-politics/next-uk-general-election/most-seats` |
| `electionYear` | Year of the next UK general election | `https://www.oddschecker.com/politics/british-politics/next-uk-general-election/year-of-next-general-election` |

A snapshot is rejected unless it contains each approved market exactly once and each market uses its exact approved URL.

## Price method

The scraper retains the best decimal odds exposed in each Oddschecker row. PULSE calculates a raw reciprocal percentage as:

`100 / decimal odds`

PULSE does not normalize the market to 100%. The public page reports the sum of captured reciprocal percentages (`marketBookPercent`) to make bookmaker margin, exchange-price mixing and incomplete-market effects visible. The result is described as a market signal, not as a calibrated probability or prediction.

## Freshness and storage

- Observation time is set when the three public market pages are captured.
- Ingestion rejects a snapshot already older than four hours.
- The record expires four hours after observation, independent of workflow execution time.
- The strict snapshot is stored under `v1:strict:bettingOdds`, separate from legacy section-cache records.
- `/metrics?section=bettingOdds` never reads the old loose cache key.
- `/all` replaces any legacy betting payload with the strict record or removes the section.
- `/health` reports the strict record as `fresh` or reports an error; `?strict=1` returns 503 when the record is unavailable.

## Fail-closed public behaviour

The frontend renders only when all of the following are true:

- the response is live Worker data;
- cache state is exactly `fresh`;
- the source timestamp has not expired;
- all three named markets are present;
- every market has a direct Oddschecker URL and a complete runner count;
- every runner has a numeric decimal price and reciprocal percentage;
- the evidence policy states that no normalization or secondary fallback is used.

All embedded betting prices have been removed. A stale, missing, malformed, legacy or fallback payload produces an unavailable state.

## Monitoring

The scheduled two-hour workflow now:

1. builds and validates the strict snapshot;
2. ingests it through the authenticated Worker endpoint;
3. retries the public section route while deployment catches up;
4. verifies the strict schema, expiry, direct market URLs and absence of legacy fields;
5. checks that `/health` reports `bettingOdds` as `ok` and `fresh`.

The workflow also runs on `main` changes to the scraper, contract, Worker wrapper or workflow itself. A scrape, ingest, schema, endpoint or health failure fails GitHub Actions rather than silently preserving older prices.

## Remaining boundary

Oddschecker is a commercial public page and may alter markup, market rules, available bookmakers or access controls. PULSE does not claim completeness, liquidity quality or predictive accuracy. If the three-market snapshot cannot be reproduced, the panel remains unavailable.
