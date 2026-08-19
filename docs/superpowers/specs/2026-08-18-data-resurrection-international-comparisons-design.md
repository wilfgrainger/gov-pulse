# Data Resurrection and International Comparisons Design

Status: Approved
Date: 18 August 2026
Repository: `wilfgrainger/gov-pulse`

## Purpose

Restore independently advancing public-data.org evidence and add a UK-focused international per-resident comparison product without weakening evidence rules.

The work has two outcomes:

1. **Data resurrection:** one failing source must not freeze unrelated verified evidence.
2. **UK in context:** compare the UK across seven separate measures with transparent years, source provenance, definitions and real comparable-country denominators.

No stale value may be labelled current. Missing values are never zero, interpolated or replaced by forecasts. No combined national score is allowed.

## Publication resilience

The current queue finaliser waits for a bounded retry deadline. After that deadline it must atomically publish the current verified subset when usable evidence exists, while keeping failed and missing job IDs in run diagnostics.

Required behavior:

- successful fresh fragments advance even when another job failed;
- expired evidence is removed;
- missing required sections produce `publicationState: "degraded"` plus an exact `missingRequiredSections` manifest;
- optional failures never veto required evidence;
- zero current source-owned evidence produces no fabricated edition;
- degraded reader evidence remains `ready: false` in `/data/health.json`;
- deployment may continue only when a verified prepared KV edition exists, including an explicit degraded edition.

## Existing feed resurrection

Audit every active source family against its current primary source:

- CPI, Bank Rate and unemployment (`sentimentPulse`)
- GDP (`gdpTracker`)
- employment and vacancies (`employmentStats`)
- national debt (`nationalDebt`)
- central-government receipts (`taxRevenue`)
- long-term migration (`migrationStats`)
- election polling (`electionPolling`)
- NHS RTT (`nhsStats`)
- betting (`bettingOdds`, optional)
- crime (`crimeStatistics`, optional)
- government contracts (optional publication source)

For a failed collector, identify whether the fault is discovery, redirect/host validation, parsing, schema drift, reconciliation or currentness. Add the smallest regression test before changing code. Do not widen freshness windows merely to make a source green.

## UK in context

### Fixed comparison universe

The selected comparison set is:

`GBR USA CHN RUS UKR DEU FRA ITA ESP TUR NLD CHE POL`

This is a fixed project comparison set, not a world ranking or an automatically changing top-13 list.

### Measures

All measures display **USD per resident** and rank highest amount first using competition ranking for ties (`1, 2, 2, 4`). Each measure has its own observation year and denominator.

1. `governmentDebt` - general-government gross debt per resident.
2. `officialDevelopmentAssistance` - comparable official development assistance per resident.
3. `defenceSpending` - military expenditure per resident.
4. `publicSocialExpenditure` - public social expenditure per resident.
5. `healthcareSpending` - total current health expenditure per resident, public plus private.
6. `taxRevenue` - economy-wide general-government tax revenue per resident.
7. `debtInterest` - interest paid on public debt per resident.

Missing country coverage remains null and is excluded from that measure's denominator. ODA countries outside the comparable donor series are not assigned zero. Healthcare must not be described as NHS-only spending. Public social expenditure overlaps with some healthcare spending and is not additive with the healthcare row. Tax revenue per resident is not an individual's tax bill.

## Authoritative source model

Prefer machine-readable publisher data with bounded requests and stable series identity.

- **IMF WEO April 2026:** current-price GDP per capita and general-government gross debt percent of GDP.
- **IMF Public Finances in Modern History:** interest paid percent of GDP.
- **OECD DAC:** ODA in current USD for comparable providers.
- **OECD SOCX:** public social expenditure percent of GDP.
- **OECD Revenue Statistics:** total general-government tax revenue.
- **SIPRI:** military expenditure, with World Bank WDI acceptable only as a machine-readable dissemination route that identifies SIPRI as the source.
- **WHO GHED:** current health expenditure per capita, with World Bank WDI acceptable only as a machine-readable dissemination route that identifies the health series.

Derived per-resident values must use compatible same-year inputs. Calculation inputs remain reproducible. Historical, estimate and projection classification belongs to each country observation and must not be silently mixed.

## Isolation and storage

International comparisons are optional relative to the national edition.

- dedicated KV key: `v1:international-comparison:current`;
- dedicated exact public route: `/data/international-comparison.json`;
- refresh from Cloudflare only;
- seven-day due guard for slow-moving annual datasets;
- source families fail independently by measure;
- an all-source comparison failure does not overwrite the last validated comparison publication;
- comparison readiness never changes national `/data/health.json` or required-section publication rules.

The data Worker therefore owns exactly three public evidence contracts:

- `/data/metrics-snapshot.json`
- `/data/health.json`
- `/data/international-comparison.json`

Normal application routes remain on the OpenNext web Worker. Pages remains the bounded seed/fallback.

## Comparison contract invariants

Every non-null country observation carries:

- country ID;
- numeric value;
- observation year;
- `historical`, `estimate` or `projection` classification;
- source publisher, HTTPS URL and series identity;
- rank;
- calculation inputs when derived.

Every null observation carries an exclusion reason and `rank: null`.

Each measure carries definition, unit, observation year, comparable-country count and all 13 country records. The denominator is the count of non-null comparable observations. `overallScore` is forbidden.

## User experience

Add `/section/uk-in-context` under **Public money**.

The page contains:

- a seven-row UK scorecard;
- UK amount per resident;
- UK rank and true denominator;
- observation year;
- full ranked country table for each available measure;
- unavailable countries and reason;
- source, series and value classification;
- method/caveat copy where needed.

The page remains structurally usable when the comparison publication is unavailable and must say so explicitly rather than rendering fake zeros or throwing.

## Testing and verification

Required regression coverage:

- partial national run advances current successful evidence after deadline;
- failed required source produces degraded publication without stale value;
- degraded prepared KV evidence can release deployment while health remains `ready: false`;
- fixed 13-country universe and exactly seven measures;
- highest-first competition ranking and truthful denominator;
- null countries never become zero;
- source/year/value classification required for every non-null observation;
- per-resident transformations and unit multipliers;
- one failed comparison source affects only that measure;
- comparison route returns 503 when no validated artifact exists;
- seven-day due guard prevents unnecessary annual-source retrieval;
- `UK in context` route/navigation works with available and unavailable evidence;
- all public routes survive production build and representative browser navigation.

Final exact-head verification must pass repository governance, lint, unit/Worker tests, deterministic Pages seed build, locked OpenNext Worker build and Playwright. Production recovery must not be claimed until the merged revision and live data routes are observed.

## Non-goals

Do not add a synthetic country-performance score, ideological ranking, analytics, paid Cloudflare services, personal-data collection, routine GitHub Actions data collection or unsupported withdrawn evidence sections.

## Success criteria

The programme is complete when healthy national feeds advance independently, every active source is either verified current or honestly unavailable, the correlated "most data down" failure is removed, `UK in context` exposes all seven approved comparison measures with transparent coverage, comparison failures cannot affect national evidence, and the exact final PR head passes the complete site-quality chain.
