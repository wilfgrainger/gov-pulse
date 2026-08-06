# Core editorial evidence contract audit — 15 July 2026

## Contract

Each active core evidence page must answer five reader questions without inventing a comparison:

1. **What changed?** A concise statement supported by the displayed observation and any genuinely comparable period.
2. **Why it matters.** Public significance without implying unsupported causation.
3. **Explain this number.** Definition, unit, geography and interpretation.
4. **Important caveat.** Revision, sampling, coverage or comparability limitations.
5. **Source and date.** Direct publisher route, publication date and observation period.

When no current evidence can be verified, the page must remain unavailable rather than render an embedded snapshot.

## Page-by-page audit

| Page | Audit finding | Resolution |
| --- | --- | --- |
| Key indicators | Separate CPI, Bank Rate and unemployment clocks existed after issue #85, but the page used non-standard headings and did not provide one selected-series definition/caveat/source block | Added the five-part explanation while retaining the series selector and evidence rows |
| GDP | Already had a supported monthly/three-month comparison and source; explanation labels varied | Moved the page-specific copy into the standard structure, retaining the ONS revision caveat |
| NHS waiting times | Already includes What changed, Why it matters, a detailed explanation, missing-trust caveat, direct NHS source and publication date | No gratuitous rewrite; the existing page-specific structure satisfies the substance of the contract |
| Migration | Missing Why it matters and could render a dated embedded fallback when the feed failed | Added the complete explanation and require a fresh live reconciled ONS payload; removed local and shared fallback values |
| Election polling | What changed described the software method rather than the evidence; public significance was implicit | Added an honest no-trend statement, a public-opinion explanation, uncertainty caveat and first-party source/date; retained the separate evidence-method note |
| National debt | Displayed an observation month but the Worker payload did not expose publication date, direct HF6W/HF6X routes or revision status | Extended the connector and introduced a strict editorial cache/route boundary; the page now fails closed without complete publication evidence |
| Government receipts | Already had a like-for-like annual comparison and direct source; explanation labels varied | Moved the page-specific definition, caveat, significance and source/date into the standard structure |

## Shared presentation

`CoreEvidenceExplanation` standardises structure, not copy. Every page supplies its own:

- significance statement;
- definition;
- unit and geography;
- interpretation;
- caveat;
- publisher link and date wording.

This avoids generic template prose while giving readers a predictable place to find the same evidence questions.

## Migration fallback withdrawal

The previous migration component and shared fallback contained the May 2026 ONS values. Although the values were previously verified, an unavailable Worker could make the dated snapshot appear as the current page headline.

The fallback now contains no migration value. The component requires:

- a live Worker response;
- a `fresh` cache state;
- a valid release date and observation period;
- arithmetic reconciliation: immigration minus emigration equals net migration;
- at least two comparable periods;
- direct ONS bulletin and dataset routes.

Failure produces an unavailable state while the withdrawn visa/nationality notice remains visible.

## National debt publication contract

The national-debt connector now retrieves:

- ONS HF6W monthly CSV for public sector net debt excluding public sector banks;
- ONS HF6X monthly CSV for the matching percentage-of-GDP measure;
- the direct HF6W series page for the ONS release date.

The record additionally preserves:

- observation period;
- publication date;
- revision status;
- direct HF6W and HF6X URLs;
- exact series IDs.

A thin `editorial-entry.js` wrapper owns a versioned strict cache record, replaces the debt record in `/all`, recomputes health from the same record and rejects publications older than 75 days. This prevents an older cache record without publication evidence from remaining visible merely because its retrieval timestamp looks fresh.

## Integrity boundaries

- No page claims a change where only one observation exists. National debt explicitly states that no movement is inferred from one stock observation.
- Election polling explicitly states that one publication is not a trend or election forecast.
- The key-indicator page does not imply that CPI, Bank Rate and unemployment describe the same month.
- GDP and receipts retain only like-for-like comparisons supported by their source releases.
- NHS wording remains specific to referral-to-treatment pathways and missing-provider estimates.
- No embedded migration or national-debt number remains in the frontend fallback contract.

## Architecture

The release remains inside one free-tier Cloudflare Worker and the existing KV namespace. `editorial-entry.js` delegates all non-debt behaviour to the existing series-aware entrypoint. No second Worker, paid product or runtime dependency is introduced.
