# PULSE metric integrity audit — 11 July 2026

## Purpose

This audit reviews every public-facing PULSE section against the service's evidence-first product principles. It is an implementation audit, not a claim that every source value has been independently re-estimated. It examines what the interface says, what data is actually live, what remains embedded, whether the measure is reproducible and whether failure states are safe.

The trigger was a production mobile observation in which the betting panel displayed an embedded snapshot led by Angela Rayner while labelling the delivery path `Embedded fallback`. That named-candidate market was no longer credible in the current political context: Andy Burnham had secured support from 322 of Labour's 403 MPs and was poised to become prime minister. PULSE must not respond to a failed feed by publishing old prices as a current market. Current-context reference: [Reuters, 10 July 2026](https://www.reuters.com/world/uk/andy-burnham-poised-become-britains-next-pm-after-most-labour-lawmakers-support-2026-07-10/).

## Rating scale

- **Critical** — a reasonable reader can mistake stale, fabricated, mixed or modelled data for a current observed measure.
- **High** — material provenance, definition, reproducibility or coverage problems can change the conclusion.
- **Medium** — the core evidence is useful, but part of the panel is static, mixed-period or insufficiently labelled.
- **Acceptable with caveat** — the panel's evidence class and limitations are broadly honest, with bounded follow-up work.

## Catalogue findings

| # | Section | Current implementation | Integrity rating | Finding | Required disposition |
|---|---|---|---|---|---|
| 1 | PM approval | Static YouGov/Ipsos-style history through February 2026; office-holder name and comparison text are hardcoded | **Critical** | The panel can remain on an outgoing prime minister and presents hand-entered values as the latest tracker. The comparison at “20 months” has no linked observation-level evidence. | Hide when no verified current poll payload exists. Model fieldwork dates, pollster, question wording, sample and direct release URL per observation. Derive the office-holder label from data, not page copy. |
| 2 | Election polling | Worker scrapes a Wikipedia aggregation and averages recent rows; embedded March 2026 fallback remains available | **High** | Wikipedia is secondary. The live average only models Reform, Labour, Conservative and Liberal Democrats, while the fallback shows Green, SNP and Others. That changes both completeness and comparability. | Replace with direct pollster feeds or a documented poll-ingestion registry. Require fieldwork dates and complete party coverage; do not mix a four-party live average with a seven-party fallback. |
| 3 | Betting odds | Two-hour scheduled Oddschecker browser import; previously fell back to hardcoded candidate, seats and election-year prices | **Critical** | Market prices are time-sensitive. Embedded values became decisively obsolete while still occupying the primary chart. | **Fixed in this iteration:** fail closed for fallback, missing, expired or incomplete snapshots. Show prices only from a complete timestamped Worker snapshot. Add ingest observability next. |
| 4 | Government approval / “polarization” | Static distribution, `68/100` index and “24 polls analysed” | **Critical** | No observation dataset or reproducible formula is stored. The chart labels a distribution of approval ratings as a polarization index, which is a stronger claim than the evidence supports. | Remove the index until the poll-level dataset, weighting, period, exclusions and formula are committed and tested. A simple sourced distribution may remain if it is accurately named. |
| 5 | Trust in government | Manually curated 2020–2025 series labelled from Ipsos and YouGov | **High** | The title says trust, source copy says satisfaction, and the values combine sources without a reproducible harmonisation rule. Event annotations risk implying causation. | Select one stable survey question/series or display separate series. Store release URLs and observations. Rename to the actual measure and label events as context, not causes. |
| 6 | National debt | Latest ONS monthly debt base extrapolated every second using trailing borrowing | **Critical** | The animated “live counter” is a PULSE model, not live official debt. Borrowing does not accrue smoothly and is not equivalent to the change in the selected debt stock. | Replace the counter with the latest official monthly observation and release period. Any nowcast must be separately labelled, documented, uncertainty-bounded and never titled “live debt”. |
| 7 | GDP | ONS growth/level series are fetched; G7 comparison and sector split remain embedded | **High** | One panel combines live ONS observations with static cross-country and sector values that may use different years, currencies, price bases and nominal/real concepts. | Split into independently sourced cards with series-level periods and units. Hide comparison/sector modules unless their releases are current and definitionally aligned. |
| 8 | Key economic indicators | CPI, Bank Rate and unemployment are fetched where possible; display configuration and some unemployment history remain embedded | **High** | The panel can contain current CPI beside stale Bank Rate or fallback unemployment while a shared panel status implies one freshness state. Hardcoded “current” labels can disagree with fetched data. | Give each series its own source period, fetched time and cache state. Remove hardcoded current values. Fail individual series closed rather than silently filling gaps. |
| 9 | Tax revenue | Rolling ONS receipts total is calculated; category amounts and tax-burden history are embedded | **High** | A live-derived total appears beside static category and forecast values without a clear boundary. Cash receipts, accrued receipts and tax burden are different concepts. | Separate receipts outturn, tax composition and tax-burden forecast. Source each from a named release and mark forecast/outturn explicitly. |
| 10 | Employment | ONS employment and unemployment rates may update; totals, vacancies, public/private split and breakdown remain embedded | **High** | The panel's shared freshness state can make several old values appear current. Labour Force Survey rolling periods and workforce datasets have different reference periods. | Move each headline to typed series-level metadata. Fetch or hide totals, vacancies and public-sector breakdown independently. Show confidence/quality caveats for LFS estimates. |
| 11 | Crime | Entirely static mixture of Crime Survey and police-recorded measures | **Critical** | The `9.3M total crime` combines concepts that should not be summed as one observed total. Category bars, regional rates, knife crime, homicide and charge-rate periods differ. “ONS recorded crime” is also an inaccurate subtitle. | Remove the total and charge-rate headline until definitions are proven. Split CSEW prevalence from police-recorded offences, with separate periods, denominators and geographies. |
| 12 | NHS and health | Worker updates one waiting-list headline; A&E, GP wait, life expectancy, workforce, specialties and trend remain embedded | **High** | A single live value upgrades the perceived currency of a multi-source static panel. Measures have different publishers, coverage and months. | Treat each metric as its own series. Fetch direct NHS England/ONS releases or hide it. Display reporting month and revision state beside every headline. |
| 13 | Migration | ONS history may update; visa categories and nationalities remain embedded | **High** | Long-term international migration estimates, visa grants and nationality tables are separate statistical systems with different periods and revision policies. The configured “quarterly” cadence is not safely assumed. | Split ONS migration estimates from Home Office visa statistics. Use publisher-declared release cadence and provisional/final status for each series. |
| 14 | UK regions | Static mixed-year map sourced from ASHE, LFS, crime and election results | **Critical** | The income layer is labelled “median household income” while the cited ASHE source measures employee earnings, not household income. Simplified regions and mixed years make ranking fragile. | Correct the measure name immediately or replace it with an actual household-income series. Use standard geographic codes, source year per layer, keyboard-operable map controls and no mixed-year composite ranking. |
| 15 | Policy links / correlation matrix | Hardcoded 8×8 correlation matrix said to be derived from BSA/Ipsos/YouGov | **Critical** | There is no committed respondent-level or tabulated source, transformation, weighting or calculation. Precise coefficients therefore cannot be reproduced or verified. | Remove the numeric matrix until a legal, citable input dataset and tested derivation pipeline exist. Do not describe “informed by” sources as if they directly publish these coefficients. |
| 16 | Political compass | Client-only illustrative quiz based on user answers | **Acceptable with caveat** | It is not a national metric, but the interface now classifies it as user-generated and states that it is not a population estimate. | Keep separate from public-performance evidence. Publish scoring logic and accessibility tests; do not include it in counts implying official/public datasets. |

## Cross-cutting architecture findings

### 1. Panel-level freshness is too coarse

Several automated panels shallow-merge live payloads into embedded objects. A successful fetch of one field can make neighbouring fallback figures look equally current. Freshness, source period and revision status must move to series-level contracts.

### 2. Embedded fallback values are unsafe for time-sensitive evidence

Fallbacks are useful for layout development but not for production claims. Political markets, polling, office-holder approval, fiscal headlines and service-performance measures should fail closed. Historical fallback data may be shown only when it carries an explicit observation period and cannot be mistaken for the latest value.

### 3. “Derived” must mean reproducible

The polarization score, policy-correlation matrix and debt-per-second model are precise outputs without sufficient committed input evidence and method. A best-in-class evidence service must ship the formula, inputs, version and validation—or remove the number.

### 4. Mixed panels need visible boundaries

GDP, tax, employment, NHS, migration and economic indicators combine series with different publishers and periods. A shared provenance footer cannot adequately describe each value. Every headline and chart series needs its own period, unit, source link, retrieval time and availability state.

### 5. Current political identity must be data, not copy

Names and roles embedded in page headings, candidate maps and fallback data become wrong quickly. Current-office-holder references must come from a verified, timestamped record or be phrased without assuming a holder.

## Remediation order

1. Fail closed for market snapshots — implemented in this iteration.
2. Remove or quarantine non-reproducible derived politics metrics: polarization and policy correlations.
3. Replace the PM approval panel with a current-office-holder-aware, observation-level polling contract.
4. Remove the modelled “live” debt counter and show the latest official monthly observation.
5. Split crime into CSEW and police-recorded measures.
6. Introduce series-level provenance and availability for mixed automated panels.
7. Correct the regional income concept and standardise geography.
8. Replace secondary polling aggregation with direct pollster ingestion.

## Definition of done for an accurate metric

A metric is production-ready only when a reader can identify:

- the exact measure and geography;
- observation/reference period;
- unit and denominator;
- named primary publisher and direct release/series URL;
- retrieved-at time and release cadence;
- revision/provisional status;
- whether the value is observed, estimated, forecast, market-derived or PULSE-derived;
- a reproducible transformation for every derived value;
- an explicit unavailable state when current evidence cannot be verified.
