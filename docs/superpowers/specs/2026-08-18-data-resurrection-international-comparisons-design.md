# Data Resurrection and International Comparisons Design

Status: Approved design, pending written-spec review
Date: 18 August 2026
Repository: `wilfgrainger/gov-pulse`
Target: public-data.org

## 1. Purpose

Restore public-data.org's active evidence feeds to a healthy, independently advancing publication model and add a new UK-focused international comparison product built from primary or authoritative international datasets.

The work has two linked outcomes:

1. **Data resurrection:** a failure in one source must not freeze unrelated current evidence. Every active feed must be traced to its real upstream boundary, repaired where genuinely broken, and either publish current evidence or fail closed with an explicit unavailable/degraded state.
2. **International comparisons:** readers should be able to answer questions such as "How does the UK compare per citizen?" across debt, overseas aid, defence, social spending, healthcare, tax revenue and debt interest without collapsing different definitions, years or country coverage into a synthetic score.

This design preserves the core public-data.org promise: no stale values labelled current, no invented replacements, no interpolation across missing countries and no combined national score.

## 2. Current architecture and diagnosed availability failure

The existing product uses Cloudflare Workers, Queues and KV for recurring publication. `worker/queued-publication-entry.js` schedules source-specific jobs, stores successful section fragments, finalises a run and prepares the public snapshot consumed through `/data/metrics-snapshot.json`.

Request-time delivery already supports explicit `ready` and `degraded` public editions. A degraded edition removes expired required sections and keeps remaining current evidence available.

The remaining availability mismatch is at the run-finalisation boundary. The current finaliser calls `publishFromCaches()` only when every expected queue job succeeds. After the retry/deadline window, one failed job can therefore prevent successful fresh fragments from advancing into the canonical publication. This can make several otherwise healthy sections appear stale or unavailable together.

### Required correction

After the bounded retry window:

- successful current source fragments must be eligible for publication;
- failed or missing jobs must remain visible in run diagnostics;
- expired evidence from a failed feed must not be retained as current;
- missing required sections must produce `publicationState: "degraded"` and appear in `missingRequiredSections`;
- optional feed failures must never block required evidence from advancing;
- a run with zero source-owned current evidence must not manufacture or publish a replacement edition;
- readiness remains stricter than reader availability: a degraded edition is usable evidence but `/data/health.json` continues to report `ready: false`.

Canonical publication still remains atomic. The change is not "publish partial writes". It is "atomically publish the current verified subset, with an exact missing-section manifest".

## 3. Data-resurrection workflow

The resurrection pass will cover every active source family currently declared in `worker/feed-registry.js` and the separate government-contracts publication source:

- CPI / Bank Rate / unemployment (`sentimentPulse`)
- GDP (`gdpTracker`)
- employment and vacancies (`employmentStats`)
- national debt (`nationalDebt`)
- central-government receipts (`taxRevenue`)
- long-term international migration (`migrationStats`)
- Westminster voting-intention polling (`electionPolling`)
- NHS referral-to-treatment waiting times (`nhsStats`)
- political betting markets (`bettingOdds`, optional)
- crime statistics (`crimeStatistics`, optional)
- government contracts (`governmentContracts`, optional publication source)

For each feed, implementation must follow the same diagnostic sequence:

1. reproduce the collector failure or prove the source is healthy;
2. capture the exact upstream URL, response status/content type and discovery decision;
3. verify the observation period and publication/retrieval clocks independently;
4. identify whether the failure is source discovery, redirect/host validation, parsing, schema drift, reconciliation, currentness or queue/finalisation;
5. create a failing regression test for the root cause;
6. make the smallest source-specific correction;
7. prove the collector with primary-source fixtures or bounded live verification where repository policy permits;
8. verify that one failing feed cannot suppress unrelated current evidence.

Freshness windows are not to be widened merely to make health indicators green. If a publisher has not issued a valid current publication inside the agreed policy, the honest outcome is unavailable/degraded.

## 4. New international comparison evidence family

### 4.1 Product concept

Add a distinct evidence product called **UK in context**. It answers one question per measure: where does the United Kingdom sit among the agreed comparison countries on a per-resident basis?

It is not a league-table score of whether a country is "good" or "bad". Higher debt is not combined with higher healthcare or higher aid. Each metric is a separate evidence statement with its own definition, year, unit, source and comparable-country count.

### 4.2 Fixed comparison universe

The initial comparison universe is deliberately fixed and transparent:

- United Kingdom
- United States
- China
- Russia
- Ukraine
- Germany
- France
- Italy
- Spain
- Türkiye
- Netherlands
- Switzerland
- Poland

The page must state that this is the project's selected 13-country comparison set, not "the whole world" and not an automatically changing top-13 ranking.

A metric may have fewer than 13 comparable countries. Missing coverage stays missing. The UK rank denominator is the number of countries with genuinely comparable observations for that metric and selected period, for example `5th of 10 comparable countries`.

## 5. Initial comparison measures

The first release contains exactly seven measures.

### 5.1 Government debt outstanding per citizen

**Definition:** general-government gross debt converted to current USD per resident for a common observation year.

**Preferred source:** IMF World Economic Outlook, April 2026 database.

**Inputs:**

- general-government gross debt, percent of GDP;
- GDP, current prices, USD;
- population.

**Calculation:** `(gross debt % GDP / 100) * GDP current USD / population`.

The output must retain whether each selected IMF country observation is historical, estimated or projected. The first public comparison should prefer the latest common non-projection year with adequate coverage. A projection may be shown only when explicitly labelled, and projection observations must not be mixed into a historical ranking.

Primary reference: `https://www.imf.org/external/datamapper/datasets/WEO`

### 5.2 Official development assistance per citizen

**Definition:** official development assistance supplied by a comparable donor, current USD per resident.

**Preferred source:** OECD DAC / Development Co-operation Profiles and OECD preliminary/final ODA datasets.

Countries outside the OECD/DAC comparable provider universe do not receive a zero. They are excluded from the denominator unless an authoritative equivalent definition is available and explicitly reconciled.

For the UK, OECD preliminary 2025 reporting records USD 17.2 billion of ODA. This value is a validation anchor, not a hard-coded application constant.

Primary references:

- `https://www.oecd.org/en/publications/development-co-operation-profiles_04b376d7-en/united-kingdom_052bbc63-en.html`
- `https://www.oecd.org/en/about/news/press-releases/2026/04/international-aid-fell-sharply-in-2025-says-oecd.html`

### 5.3 Defence spending per citizen

**Definition:** military expenditure in current USD per capita.

**Preferred source:** SIPRI Military Expenditure Database.

SIPRI already publishes current-USD and per-capita series, so the application should prefer the publisher's per-capita measure rather than recomputing it unnecessarily.

Primary reference: `https://www.sipri.org/databases/milex`

### 5.4 Public social expenditure per citizen

**Definition:** public social expenditure converted to USD per resident for the selected year.

**Preferred source:** OECD Social Expenditure Database (SOCX), public total social expenditure.

SOCX covers OECD members and selected countries and includes estimates through 2024. Non-covered countries remain unavailable. The product must explain that OECD public social spending includes programmes such as pensions, health, family support and unemployment benefits, so this measure overlaps conceptually with some public healthcare spending and must not be added to the healthcare row as if categories were mutually exclusive.

Preferred calculation where SOCX supplies percent of GDP: `(public social expenditure % GDP / 100) * comparable GDP USD / population` using a same-year authoritative GDP/population denominator.

Primary reference: `https://www.oecd.org/en/data/datasets/social-expenditure-database-socx.html`

### 5.5 Healthcare spending per citizen

**Definition:** current health expenditure (CHE) per capita in USD, public plus private, using the WHO definition.

**Preferred source:** WHO Global Health Expenditure Database / Global Health Observatory indicator `CHE_pc_US$`.

The UI must say **total healthcare expenditure**, not NHS spending or government health spending.

Primary references:

- `https://apps.who.int/nha/database/DocumentationCentre/en`
- `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/current-health-expenditure-%28che%29-per-capita-in-us%24`

### 5.6 Tax revenue per citizen

**Definition:** total general-government tax revenue divided by population for the selected comparable year.

**Preferred source:** OECD Revenue Statistics / OECD Data Explorer.

The UI must say this is economy-wide tax revenue per resident, not the tax bill of an average individual. Countries without a directly comparable OECD Revenue Statistics series are excluded rather than assigned an approximation from unrelated fiscal measures.

Primary reference: OECD Revenue Statistics SDMX / Data Explorer, including the country-specific `DSD_REV_OECD` flows.

### 5.7 Debt-interest spending per citizen

**Definition:** interest paid on public debt converted to current USD per resident for a common historical year.

**Preferred source:** IMF Public Finances in Modern History dataset for interest paid as percent of GDP, combined with same-year GDP/population data.

For the UK, the IMF dataset currently reports interest paid at 2.84% of GDP in 2024. This is a validation anchor, not a hard-coded application constant.

Primary reference: `https://www.imf.org/external/datamapper/profile/GBR`

A separate UK-only contextual note may link to the House of Commons Library or OBR domestic debt-interest measure, but it must not replace the IMF measure inside the international ranking because the accounting basis differs.

## 6. Comparison data contract

The international comparison data is separate from the existing UK runtime snapshot contract. It will have one authoritative machine-readable artifact with a schema resembling:

```ts
interface InternationalComparisonPublication {
  meta: {
    schemaVersion: number;
    generatedAt: string;
    comparisonSetId: "uk-context-13-v1";
    countries: CountryId[];
    sourceVersions: Record<string, string>;
  };
  measures: Record<ComparisonMeasureId, ComparisonMeasure>;
}

interface ComparisonMeasure {
  id: ComparisonMeasureId;
  label: string;
  definition: string;
  unit: "USD per resident";
  selectedObservationYear: number;
  rankDirection: "highest-first";
  comparableCountryCount: number;
  countries: Array<{
    country: CountryId;
    observationYear: number | null;
    valueType: "historical" | "estimate" | "projection" | null;
    value: number | null;
    rank: number | null;
    source: SourceProvenance | null;
    exclusionReason?: string;
  }>;
}
```

The implementation may refine exact field names, but the following invariants are mandatory:

- every non-null value has a country, observation year, value type, unit and source provenance;
- only observations matching the measure's selected observation year and comparison basis are eligible for ranking;
- rank means **highest amount per resident first** for all seven v1 measures;
- rank is computed only over non-null comparable values;
- ties use a documented competition-ranking rule;
- the UK denominator equals the actual number of comparable observations;
- unavailable countries retain an exclusion reason when known;
- historical, estimated and projected observations are not silently mixed in one ranking;
- calculation inputs are retained or reproducible for derived per-capita values;
- no aggregate overall score exists.

## 7. Source ownership and refresh model

The comparison product is **optional** relative to the national edition. It can never make GDP, debt, migration, NHS or other UK evidence unavailable.

A separate comparison registry will define, per measure:

- publisher;
- source class;
- retrieval URL/API/dataflow;
- supported countries;
- observation period policy;
- refresh cadence;
- expected update cadence;
- transformation/calculation method;
- maximum publication age;
- public caveat.

The comparison publication will update on a slow cadence appropriate to annual datasets. Daily polling of annual files is unnecessary. The implementation plan should prefer a low-frequency Cloudflare schedule or piggyback on an existing daily run with an explicit due-date guard so no network requests occur when the source is not due for checking.

No recurring comparison collection moves to GitHub Actions.

## 8. User experience

### 8.1 Entry point

Add `UK in context` under the public-money/economy evidence experience and provide a prominent route from relevant debt/public-money pages. It may also be surfaced from the homepage as a secondary evidence feature, but it must not displace the current national-edition lead algorithm in v1.

### 8.2 UK scorecard

The initial view is a compact table with one row per measure:

- measure;
- UK amount per citizen;
- UK rank;
- comparison denominator;
- observation year;
- concise interpretation.

Examples of interpretation style:

- `3rd highest of 13 comparable countries`
- `5th highest of 10 comparable donors`
- `Middle of the comparison group`

Avoid medal emojis or celebratory language for public debt/spending rankings in the production evidence UI. Rankings are descriptive, not awards.

### 8.3 Measure detail

Each row opens or links to the full country comparison for that measure, showing:

- all comparable countries ranked;
- unavailable countries separately, with the reason where known;
- source and publication date;
- exact definition;
- calculation note for derived values;
- caveat explaining whether the observation is historical, estimated or projected.

Charts are optional in v1. If used, they must be accessible, use the same underlying values as the table and not obscure missing countries.

## 9. Error handling and degraded states

### Existing UK evidence

- one failed source must not suppress unrelated current evidence after the bounded retry deadline;
- missing required evidence creates a degraded edition;
- missing optional evidence does not change readiness of otherwise complete required evidence;
- no current evidence means unavailable, not a fabricated edition.

### International comparisons

- one failed metric source removes or marks only that measure unavailable;
- one unavailable country removes that country only from that measure's rank denominator;
- a source-version mismatch or unexpected schema fails that metric closed;
- the comparison artifact may be partially available at measure level, with an explicit metric status;
- the national evidence snapshot does not depend on comparison readiness.

## 10. Testing strategy

### Publication resilience

Add regression coverage proving:

- a required feed failure after the deadline still allows successful fresh fragments to advance atomically as a degraded edition;
- an optional feed failure cannot veto required publication;
- an all-failed run with no current source-owned evidence cannot claim success;
- `/data/health.json` stays `ready: false` for degraded required evidence;
- an expired section is absent from both body and source provenance.

### Collector resurrection

For every repaired collector, add the smallest fixture/test that reproduces the source drift or parser/discovery failure. Freeze test clocks where currentness is involved so tests do not decay with wall-clock time.

### International comparisons

Add tests for:

- fixed 13-country universe;
- per-metric missing-country coverage;
- rank denominator calculation;
- descending highest-first ranking;
- ties;
- no rank for null values;
- ODA countries outside comparable donor coverage not becoming zero;
- social-spending overlap caveat retained;
- healthcare labelled total CHE rather than government/NHS spending;
- country-level historical/estimate/projection classification;
- rejection of mixed-period/mixed-basis observations from a ranking;
- per-capita transformation math and population units;
- source provenance and observation year on every non-null value;
- absence of a combined score;
- comparison feed failure having no effect on national snapshot publication.

### Delivery

Run the repository's existing exact-head quality gates: governance checks, lint, unit/Worker tests, deterministic Pages seed build, locked OpenNext Worker build and Playwright. Add one representative browser journey for `UK in context` rather than multiplying E2E tests across every metric.

## 11. Source verification and trust rules

The implementation must prefer machine-readable publisher data over manually copied values. When a source exposes an SDMX/API/data-download endpoint, store the stable query/series identity in the comparison registry.

For every source:

- follow redirects only within the expected publisher boundary;
- bound response sizes and timeouts;
- validate content type and schema;
- retain source version/publication date where available;
- retain raw observation year separately from retrieval time;
- do not infer missing observations;
- document currency basis and whether the publisher already supplies per-capita values;
- derive values only from inputs with the same selected observation year unless explicitly labelled otherwise.

## 12. Rollout sequence

Implementation will be split into small, reviewable stages inside one feature programme:

1. **Publication resilience:** correct the run-finalisation choke point and lock it with regression tests.
2. **Feed resurrection audit:** execute every active collector against its current primary source, repair root causes and record remaining legitimately unavailable feeds.
3. **Comparison contract and registry:** introduce the isolated international evidence schema and source ownership.
4. **Comparison collectors/calculations:** implement the seven measures, source by source, with fixtures and provenance.
5. **UK in context UI:** scorecard, measure detail, source/caveat presentation and navigation.
6. **Full verification:** exact-head CI, representative E2E, source-health review and live post-deploy verification after merge.

The implementation plan may split these stages into more than one pull request if the repository's focused-change guard requires it. The programme must not weaken the guard merely to force the entire feature into one PR.

## 13. Non-goals

This work does not:

- create a synthetic national-performance score;
- rank countries by ideology or political desirability;
- claim foreign aid includes every form of geopolitical or military support;
- equate total healthcare expenditure with NHS spending;
- treat public social expenditure and healthcare as additive non-overlapping categories;
- convert missing countries to zero;
- move recurring collection back to GitHub Actions;
- introduce paid Cloudflare products, analytics or personal-data tracking;
- restore previously withdrawn unsupported site concepts merely to make the section count larger.

## 14. Success criteria

The programme is complete when:

1. current healthy UK feeds advance independently after scheduled collection even when another feed fails;
2. every active feed has either current verified evidence or an honest source-specific unavailable/degraded reason;
3. the live site no longer presents a correlated "most data down" failure caused by one queue job;
4. `UK in context` publishes the seven approved comparison measures with transparent per-metric country coverage;
5. every UK rank shows its true denominator and observation year;
6. all non-null comparison values are source-reproducible and retain provenance;
7. no comparison failure can make the national edition unavailable;
8. the repository's exact-head validation and production verification pass without GitHub Actions artifact storage.

## 15. Evidence-source notes verified at design time

The following source capabilities were re-verified on 18 August 2026:

- IMF WEO April 2026 exposes population, current-price GDP and general-government gross debt through 2031 and distinguishes the WEO dataset from other IMF sources.
- OECD preliminary 2025 ODA reporting records UK ODA at USD 17.2 billion and identifies the comparable DAC-provider context.
- SIPRI's Military Expenditure Database covers 1949-2025 and explicitly publishes current USD and per-capita military expenditure.
- OECD SOCX covers all OECD countries plus selected accession countries and currently provides estimates through 2024.
- WHO GHED/GHO defines `CHE_pc_US$` as current health expenditure divided by population in USD.
- OECD Revenue Statistics exposes country-specific SDMX dataflows for total general-government tax revenue.
- IMF Public Finances in Modern History currently exposes UK interest paid on public debt at 2.84% of GDP for 2024.

These notes establish source fitness for implementation. Production values must still come from the implemented collector/data query, not from prose in this design document.
