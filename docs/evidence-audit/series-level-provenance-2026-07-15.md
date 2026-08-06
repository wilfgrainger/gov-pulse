# Series-level freshness and provenance audit — 15 July 2026

## Scope

Issue #85 asks whether each active PULSE headline exposes the evidence clock and source that actually belong to the displayed value. The audit covered every active automated panel and the user-generated political compass.

The required fields are:

- observation period;
- publisher and direct source link;
- retrieval time where a feed is automated;
- revision status or equivalent market/publication status;
- evidence class.

## Active-panel audit

| Panel | Evidence structure | Audit outcome |
| --- | --- | --- |
| Election polling | Each accepted poll is a separate first-party publication with fieldwork, publication date, sample, commissioner, question/headline, method, uncertainty and direct source | Compliant; no synthetic average |
| Betting markets | Each named market retains one direct Oddschecker URL, observation time, raw decimal odds and raw reciprocal percentage | Compliant; stale or incomplete snapshots fail closed |
| National debt | Two named ONS public-sector-finance series form one matched observation | Compliant as a paired official measure |
| GDP | Monthly and three-month movements come from one ONS monthly GDP bulletin | Compliant; one publication and explicit revision caveat |
| Key indicators | CPI, Bank Rate and unemployment came from different clocks but were previously carried onto one CPI-led timeline | Rebuilt in this tranche |
| Government receipts | One monthly central-government-receipts measure and like-for-like annual comparison from one ONS bulletin | Compliant |
| Employment | Labour Force Survey rates and vacancies use separate survey periods in one ONS labour-market publication | Added near-value series evidence in this tranche |
| NHS waiting times | Headline and treatment-function rows come from one NHS England RTT publication with explicit missing-trust treatment | Compliant; caveat differs by row class |
| Migration | Immigration, emigration and net migration come from one ONS long-term migration release and reconcile arithmetically | Compliant |
| Political compass | Calculated from the current user session | Compliant as user-generated evidence; no public-data freshness claim |

Withdrawn panels are outside the active evidence inventory and display no current value.

## Key-indicator defect removed

The former key-indicator panel:

- aligned Bank Rate and unemployment to CPI observation dates;
- carried the latest prior value forward when no same-period observation existed;
- included a hardcoded unemployment fallback table;
- included hardcoded current headline strings;
- exposed one panel-level retrieval status rather than the clocks of the three series.

This could make three sources look contemporaneous when they were not.

## New key-indicator contracts

### CPI inflation

- Publisher: Office for National Statistics.
- Series: D7G7 in MM23.
- Frequency: monthly.
- Observation period: the named calendar month.
- Publication date: parsed from the ONS series page.
- Retrieval time: recorded by the Worker for the successful fetch.
- Revision status: consumer-price estimates follow the ONS revision policy.
- Direct source: the D7G7 series page.

### Official Bank Rate

- Publisher: Bank of England.
- Series: IUDBEDR in IADB.
- Frequency: event-driven Monetary Policy Committee decisions.
- Observation period: the effective decision date.
- Publication date: the same event date in the official rate history.
- Retrieval time: recorded by the Worker.
- Revision status: event-dated history rather than a monthly statistical estimate.
- Direct source: the Bank of England official Bank Rate history.

Bank Rate may remain current for months. Its age is not interpreted as a missing monthly observation.

### Unemployment rate

- Publisher: Office for National Statistics.
- Series: MGSX in LMS.
- Frequency: monthly publication of a rolling three-month Labour Force Survey estimate.
- Observation period: calculated and displayed as the full rolling three-month period.
- Publication date: parsed from the ONS series page.
- Retrieval time: recorded by the Worker.
- Revision status: subject to sampling uncertainty and later revision.
- Direct source: the MGSX series page.

## Retrieval and currentness

The Worker retrieves the five required source documents together:

1. CPI official CSV;
2. CPI series publication page;
3. unemployment official CSV;
4. unemployment series publication page;
5. Bank Rate official history.

If any source fails, the complete panel fails closed. The Worker does not substitute an embedded value.

Retrieval freshness and statistical currentness remain separate:

- the Worker refreshes every four hours;
- a successful record is operationally fresh for 36 hours;
- the two monthly ONS publications must remain inside a 75-day publication window;
- Bank Rate is validated as an event-dated series rather than forced into the ONS monthly rule.

A legacy cache record containing `economicData` or `metricConfig` is rejected even when its fetch timestamp looks fresh and is rebuilt on the first section or combined-dataset request.

## Reader presentation

The reusable `SeriesEvidence` treatment presents each series beside its value with:

- its own observation period;
- publisher and direct source link;
- publication date;
- Worker retrieval time;
- revision status;
- evidence class;
- an important distinction where the series has a non-obvious clock.

The treatment is applied to:

- all three key indicators;
- Labour Force Survey rates and vacancies on the employment page.

The existing repaired panels already carry equivalent source-specific disclosure through their publication briefing, evidence register, direct market link or explicit methodological caveat.

## Production assurance

The live-feed canary now rejects the key-indicator section unless:

- all three exact series IDs and dataset IDs are present;
- publishers and direct source URLs match the contract;
- observation, publication and retrieval timestamps are valid;
- history ends at the displayed current observation;
- revision status is present;
- `economicData` and `metricConfig` are absent.

The `/all` route overwrites any legacy combined-dataset value with the strict record. The health route reports the same strict cache record and fails strict monitoring when it is unavailable or expired.

## Architecture constraint

The change remains within the existing single Cloudflare Worker and KV namespace. A thin `series-entry.js` wrapper extends the existing evidence entrypoint; no paid Cloudflare product, second Worker or new runtime dependency is introduced.
