# Deep-dive review: UI, customer experience and data feeds

*Date: 1 August 2026 · Scope: `public-data.org` (gov-metrics)*

## Method

This review is based on the running application, not a read-through. I installed
the toolchain, started the app, and measured the rendered result:

- rendered and captured `/`, `/sources` and section routes at 390px, 1024px,
  1280px, 1440px and 1600px;
- measured element geometry in the live DOM to detect overlap and overflow;
- computed WCAG 2.1 contrast ratios from **canvas-converted sRGB values**, because
  Tailwind v4 emits `lab()` and `oklch()` colours that naive string parsing
  silently mangles into near-black (an earlier pass produced 42 false positives
  this way — worth knowing before trusting any contrast tooling on this codebase);
- checked heading order, landmarks, `alt` coverage and tap-target sizes;
- probed candidate upstream data sources over the network to confirm they are
  live, free, unauthenticated and machine-readable;
- traced which configuration is actually consumed by the collectors.

Baseline before changes: `npm run lint` clean, 392 unit tests across 80 files
passing, `npm run build` clean. This is a well-maintained repository.

Note: the local environment has no `public/data/metrics-snapshot.json`, so every
automated section renders its unavailable state. That turned out to be useful —
the empty state is a large part of the real customer experience — but it means
the populated chart surfaces were reviewed as code, not as pixels.

---

## 1. What is genuinely strong

Worth stating plainly, because the weaknesses below are refinements on a good
product, not a rescue.

- **Evidence integrity is the best thing here and it is rare.** Failing closed,
  refusing to synthesise a combined crime total, keeping Crime Survey and
  police-recorded offences apart, separating polling from official statistics,
  and withdrawing five sections rather than showing stale numbers — this is the
  discipline most public dashboards lack. It is a real competitive moat.
- **The unavailable states are honest and well written.** "public-data.org could
  not verify a complete current NHS England referral-to-treatment publication.
  It will not show an older waiting-list snapshot or unrelated embedded health
  measures as current." That is better than almost any commercial equivalent.
- **The editorial design system is confident** — cream/navy/crimson, Georgia
  display serif, flat borders, no decoration. Section pages in particular are
  typographically excellent.
- **Accessibility fundamentals are in place**: one `h1` per page, `main`/`nav`
  landmarks, full `alt` coverage, no horizontal overflow at any width tested,
  visible focus rings, `prefers-reduced-motion` honoured, and screen-reader data
  tables behind charts.
- The July 2026 contrast findings in `improve-ui-report.md` were all genuinely
  fixed, not papered over.

---

## 2. Defects found and fixed in this pass

All five were measured, not inferred. All gates re-run green afterwards.

### 2.1 Desktop navigation text physically overlapped — every desktop width

The primary section navigation rendered category labels on top of section links,
making both unreadable. Measured overlaps:

| Width | Overlapping pairs | Worst case |
|---|---|---|
| 1024px | 6 | "Public money" over "Employment" by **89.6px** |
| 1280px | 3 | "Employment" over "Public money" by 8.8px |
| 1440px | 3 | "Employment" over "Public money" by 8.8px |
| 1600px | 3 | "Employment" over "Public money" by 8.8px |

At 1024px the strip read `MarkECONOMY`, `ReceiptPUBLIC MONEY`, `ContraSOCIETY`,
`CrimTOOLS`. This is the site's main wayfinding, broken on every desktop
viewport, in a product whose entire value proposition is credibility.

Cause: category label spans were `shrink-0` but the `Link`s were not, so flex
compressed the links below their intrinsic text width and the text overflowed
its box. `min-w-0` on the group wrappers made it worse.

Fix (`app/components/SectionNav.tsx`): `shrink-0` and `whitespace-nowrap` on the
links and group wrappers, `overflow-x-auto` on the strip so a long registry
scrolls rather than collides. Now **0 overlapping pairs at all four widths**.

### 2.2 Eyebrow labels on dark panels failed contrast — a silent CSS cascade bug

`<p className="eyebrow text-red-300">` appeared twice. The author's intent was
light red on a dark panel. But `.eyebrow` is declared unlayered in
`globals.css`, and Tailwind v4 utilities live in a `@layer`, so **unlayered
`.eyebrow` wins and `text-red-300` is silently dead**. Result: crimson `#8a3540`
on dark:

- "Start here" on `#000000` — **2.66:1** (needs 4.5:1)
- "About public-data.org" on `#172234` — **2.03:1** (needs 4.5:1)

This is worth internalising as a pattern, not just a fix: **any Tailwind `text-*`
utility combined with `.eyebrow`, `.page-title`, `.section-title`, `.font-display`
or `.text-accent` is inert.** Those six unlayered classes will beat it every time.

Fix: added an `--accent-on-dark: #f6a5ad` token (a hue-matched light tint of the
crimson accent — 8.3:1 on navy, 10.9:1 on black) and an `.eyebrow-on-dark`
class, then used it in both places. The two `text-red-300` uses that are *not*
combined with `.eyebrow` were left alone; they work as intended.

### 2.3 Low-contrast metadata labels

The one-off grey `#747a83` was used for uppercase 12px labels in nine places:
**4.33:1 on white** and **3.91:1 on cream**, both below AA for body-size text.

Fix: replaced with the existing `--muted` design token (`#60636a`), which passes
comfortably at 6.02:1 on white and 5.44:1 on cream. This uses the system that
was already there rather than inventing another hex value.

### 2.4 "1 views"

`EvidenceGroup` rendered `{itemCount} views`, so the Public money and Tools
accordions read **"1 views"**. On a site whose product is editorial precision,
a grammar error in the navigation chrome is disproportionately costly.

Fix: proper pluralisation.

### 2.5 Broken heading order on every section route

Section components open at `h3` so they nest correctly under the homepage card
headings. On a dedicated `/section/[id]` route, `PageHeader` supplies the `h1`,
so the order jumped `h1 → h3` — a WCAG 1.3.1 failure on all 18 section routes.

Fix: a screen-reader-only `h2` naming the region. Verified `h1,h2,h3` with zero
jumps on `/section/nhs`, `/section/national-debt`,
`/section/government-contracts`.

### Verification

`0` nav overlaps at 1024/1280/1440/1600px · `0` contrast failures across five
page-and-viewport combinations · `0` heading-order jumps · lint clean · 392 unit
tests pass · production build clean · 11 e2e tests pass (2 skipped are
live-deployment specs).

---

## 3. The central customer-experience problem: the homepage has no numbers

This is the most important finding in the review and it is not a bug — it is a
product decision that I think is now costing more than it earns.

**The homepage contains zero data.** Every one of the eight "national signal"
cards is prose: a label, a title, "What this helps answer", "Why it matters",
"Source type", and a link reading "See the latest change and source". A visitor
who wants to know what inflation is gets a card explaining why inflation
matters, and must click through to find out.

The scale of it:

- **Mobile homepage: 8,470px tall** — roughly ten full screens — containing not
  one figure.
- **`/sources` on mobile: 15,270px** — about eighteen screens.
- The full evidence library sits inside five `<details>` accordions that are all
  **collapsed by default**, so every actual chart is at least one click away and
  invisible to `Ctrl+F`.
- The same taxonomy is then repeated three times on one page: national-signal
  cards, "Explore the figures" accordions, and the footer link columns.

The intent is clear and defensible — the copy says "This is a route map, not a
scorecard" and the concern about implying a combined national score is exactly
the right instinct. But a route map is what you need *once*. Every returning
visitor pays the full cost of it on every visit, and the thing they came for is
never on screen.

No market-leading data product does this. The FT, ONS dashboards, Our World in
Data and Trading Economics all lead with the current value, its period, and its
direction. Leading with numbers does not require a composite score — it requires
each card to carry **its own** number with its own period and source, which is
precisely what this codebase's observation model already guarantees.

**Recommendation.** Put the accepted figure on the signal card: value, unit,
observation period, change on the stated comparison basis, and evidence-class
badge. Keep the "what this answers / why it matters" copy — move it below the
number, or into the section page. Where a series is unavailable, say so on the
card, which is more informative than prose and reinforces the integrity story
rather than hiding it. Then default the first evidence accordion to open, and
drop one of the three duplicate taxonomies.

This is the single highest-leverage change available. It converts the site's
integrity work from something a reader must take on trust into something they
can see immediately.

### Secondary CX gaps

- **The unavailable state is a dead end.** It correctly refuses to show a stale
  figure, but offers no next step. `trusted-government-lens.md` already permits
  the better behaviour: "retain the last observation only when clearly labelled
  with its publication period and retrieval state". Showing *"Last verified:
  4.1% for March 2026. Next scheduled release: 14 August"* is honest, more
  useful, and still fails closed on currentness.
- **No release calendar surfaced at point of use.** `nextReleaseDate` exists on
  the crime and key-indicator paths, and `PublicationLedger` links to the ONS
  calendar, but a reader looking at one figure cannot see when it next updates.
  It is roadmap item 2 and a stated platform contract.
- **No data export anywhere.** `trusted-government-lens.md` commits to "CSV and
  JSON exports only for supported, reproducible observations", and there is no
  download affordance in the UI. This is cheap — the contract-checked snapshot is
  already a public same-origin asset — and it is what converts journalists and
  analysts from readers into citers. See §5.
- **`DataHealthBar` reports "0 of 9 core releases are current"** to the public
  when the snapshot is degraded. Accurate, but it leads with a number that reads
  as total system failure. Prefer naming what *is* current, with the count
  secondary.
- **Tap targets**: footer and source-register link columns render at 16–20px
  height. Inline links inside sentences are exempt from WCAG 2.2 target-size,
  but these are list navigation and are not. Worth a pass.

---

## 4. Data coverage against your own target architecture

`docs/architecture/trusted-government-lens.md` defines a 15-part information
architecture and a 15-step roadmap. Measured against it:

| Target section | State |
|---|---|
| 1. National signals | Built (prose only — see §3) |
| 2. Economy and GDP | Built |
| 3. Public finances and debt | Built |
| 4. Tax and spending | Receipts only; no spending lens |
| 5. Migration | Built |
| 6. NHS and public services | RTT only; A&E, ambulance, GP withdrawn |
| 7. Contracts and procurement | Built — strongest module |
| 8. Policy decisions / distributional impact | **Absent** |
| 9. Elections, polling, forecasts | Built |
| 10. Cost of living | **Absent** |
| 11. Housing and infrastructure | **Absent** |
| 12. Crime, courts and prisons | Crime built; prisons absent |
| 13. Energy, climate and resilience | **Absent** |
| 14. Regions and nations | **Withdrawn** (no valid comparable geography) |
| 15. Sources, revisions, methodology | Built; **no API or export** |

Twelve automated series are live. Five sections are withdrawn. The gaps are not
random: **cost of living, housing and energy are the three topics the UK public
searches for most**, and all three are missing. For a service whose mission is
"a first-time reader should quickly understand what changed, why it matters",
the absence of household-facing evidence is the biggest coverage weakness.

### A structural risk worth fixing first

There are **two divergent ONS series registries**, and the authoritative-looking
one is inert:

- `app/lib/config.ts` exports `ONS_SERIES` (8 keys, `SCREAMING_CASE`, with
  `topicPath` and `datasetId`), plus `BOE_SERIES`, `ONS_CSV_BASE` and
  `BOE_API_BASE`. It is headed "Public UK data source endpoints". **All four
  exports are imported by nothing.**
- `worker/index.js` declares its own `ONS_SERIES` (13 keys, `snake_case`:
  `cpi`, `psnd`, `psnb`, `tax_receipts`, `net_migration`, …) and its own
  `ONS_CSV_BASE`. This is what actually runs.

So `config.ts` is the file a newcomer would naturally edit to add a series, and
editing it changes nothing. Worse, `BOE_SERIES.BANK_RATE = "IUDBEDR"` implies the
Bank Rate arrives via a series API, when the collector actually scrapes
`Bank-Rate.asp` HTML. Any new-feed work should start by collapsing these into one
registry — otherwise every feed below inherits the ambiguity.

---

## 5. New data feeds — validated, not speculative

I probed each candidate over the network. Results are what the endpoints
returned today.

### Tier 1 — near-zero architectural cost (reuses the existing ONS CSV collector)

The collector already fetches any ONS timeseries from
`https://www.ons.gov.uk/generator?format=csv&uri=…`. Adding a series is a
registry entry plus a contract test — no new integration.

| Series | CDID | Confirmed |
|---|---|---|
| **AWE real-terms total pay, YoY 3-month growth** | `A3WW` | HTTP 200, CSV, dataset `LMS` |
| **CPI: food and non-alcoholic beverages** | `D7BU` | HTTP 200, CSV, dataset `MM23` |

`A3WW` is the highest-value single addition on this list. Real-terms pay growth
is *the* cost-of-living headline — it is what "are people getting poorer?"
actually means — it is officially published, seasonally adjusted, and available
right now through infrastructure that already exists. Paired with `D7BU` (food
inflation, the most salient household price), that is a credible **Cost of
living** section for very little engineering.

One caveat: the ONS generator returns HTTP 200 with an HTML error page for
invalid URIs (I hit this with a wrong dataset path), so the contract must assert
CSV shape and the expected `CDID`, never just the status code.

### Tier 2 — highest strategic value: UK House Price Index

`https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/UK-HPI-full-file-2026-05.csv`

- HTTP 200, current to **May 2026**, 34.8 MB
- **Supports HTTP range requests** (verified `206`) — can be parsed incrementally
- Columns include `Date, RegionName, AreaCode, AveragePrice, Index, IndexSA,
  1m%Change, 12m%Change, SalesVolume`, plus splits by property type, cash vs
  mortgage, new vs old, and **first-time buyer**
- `AreaCode` carries **ONS statistical geography codes** (`E12000003` for a
  region, `S12000034` for a Scottish council area)

This one dataset unlocks **two** roadmap items at once. It is the obvious
Housing section (roadmap 10). But it is also the cleanest route out of the
withdrawn regional comparison (roadmap 14), because
`source-repair-backlog.md` blocks that work on "one complete versioned dataset
joined to official geography" — and this is exactly that, with valid ONS codes
and parentage, from a single publisher on a single basis.

Two engineering notes. At 34.8 MB it should be collected in GitHub Actions
rather than a Free-tier Worker, which the architecture already permits via
`scripts/`. And `SalesVolume` is empty for the two most recent months — the data
is provisional and revised, so this feed exercises the revision model properly
rather than bolting onto it.

### Tier 3 — live energy and climate

`https://api.carbonintensity.org.uk/intensity` and `/generation` (National Grid ESO)

- Both HTTP 200, JSON, free, **no authentication**
- Returns explicit `from`/`to` half-hourly period bounds — maps directly onto the
  `periodStart`/`periodEnd` observation model with no interpretation
- `/generation` gives the live fuel mix (gas 38.2%, imports 13.6%, biomass 10.7%,
  coal 0% at time of probe)

This is the cleanest new integration available and the only genuinely live feed
in the estate. It needs its own evidence class — it is operational
administrative data, not an official statistic, and the existing
`EvidenceClass` union has no good home for it. Add one rather than
mislabelling it.

### Not recommended yet

- **Bank of England series CSV** (`fromshowcolumns.asp`) returned HTML, not CSV,
  on the parameters I tried. The existing HTML scrape of `Bank-Rate.asp` works;
  leave it until someone can confirm the CSV interface properly. A mortgage-rate
  series (`IUMBV34`) would strengthen cost of living, but not on an unverified
  endpoint.
- **Prison population** — the GOV.UK collection URL I tried 404s. The weekly
  figures exist but need a discovery step against the rolling publication page,
  the same problem already logged as crime Priority 1. Do that discovery pattern
  once, then reuse it.

### The missing platform feature: exports and a citable API

Roadmap item 15 and a stated platform contract, with nothing built. This is the
cheapest large win in the review: the contract-checked snapshot is *already* a
public same-origin JSON asset. What is missing is a per-series CSV/JSON download
button and a documented, stable, citable URL per observation.

For the analysts, journalists and public servants named in the architecture
document as core users, export is not a nice-to-have — it is the difference
between a site they read and a source they cite. Citation is how a public-evidence
service compounds.

---

## 6. Recommended sequence

Ordered by value per unit of effort, not by size.

1. **Put numbers on the homepage signal cards** (§3). Highest leverage in the
   review; needs no new data.
2. **Collapse the two ONS series registries into one** (§4). Small, and every
   later feed depends on it.
3. **Add `A3WW` and `D7BU` as a Cost of living section** (§5 Tier 1). First new
   topic, near-zero integration cost, closes the most-searched gap.
4. **Ship CSV/JSON export per series** (§5). Cheap, and converts readers into
   citers.
5. **Surface next-release dates on unavailable states** (§3). Turns the dead end
   into the most trustworthy moment on the site.
6. **Integrate UK HPI** (§5 Tier 2) for Housing, then reuse its geography to
   revive regional comparison.
7. **Add the Carbon Intensity feed** with a new evidence class (§5 Tier 3).
8. Revisit tap-target sizes and the `DataHealthBar` framing (§3).

## What I did not do

Items 1 and 3–8 above are product decisions with real design and contract
consequences, so this review proposes them rather than implementing them. I
fixed only the five measured defects in §2, which are unambiguous and low-risk.

The populated chart surfaces were reviewed as code, not pixels, because no
snapshot exists locally. A pass over the charts against a real snapshot —
particularly the axis, tooltip and provisional-data treatment in
`FinancialTimeSeriesChart` and `NHSStats` — is still worth doing.
