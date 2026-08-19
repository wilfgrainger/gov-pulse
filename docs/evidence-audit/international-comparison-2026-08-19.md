# International comparison evidence audit — 19 August 2026

## Scope

This audit records the source basis for the optional `UK in context` comparison publication. The comparison plane is independent of the national evidence edition: a comparison-source failure must not change national readiness or suppress current UK evidence.

## Fixed comparison set

United Kingdom, United States, China, Russia, Ukraine, Germany, France, Italy, Spain, Ireland, Netherlands, Switzerland and Poland.

The corrected comparison-set identity is `uk-context-13-v2`; the initial implementation had substituted Türkiye for the agreed Ireland membership.

## Measures and source basis

| Measure | Observation | Source basis | Transformation |
|---|---:|---|---|
| Government debt outstanding | 2026 projection | IMF World Economic Outlook April 2026, projected general-government gross debt as % GDP plus projected current-price GDP per capita | `% GDP × GDP per resident` |
| Official development assistance | 2025 preliminary | OECD DAC1, total ODA grant equivalent in current USD for comparable providers | `total USD ÷ same-year population`; countries outside the comparable donor series remain unavailable |
| Defence spending | 2025 | SIPRI military expenditure 2025, current USD | `total USD ÷ same-year population` |
| Public social expenditure | 2023 | OECD SOCX public social expenditure as % GDP; 2023 is used as the latest comparable year that includes a UK observation | `% GDP × same-year GDP per resident` |
| Total healthcare expenditure | 2024 | WHO Global Health Expenditure Database series disseminated through World Bank WDI `SH.XPD.CHEX.PC.CD` | publisher-reported USD per resident |
| Tax revenue | 2024 | OECD Revenue Statistics total general-government tax revenue as % GDP | `% GDP × GDP per resident` |
| Debt interest | 2024 | IMF Public Finances in Modern History, interest paid as % GDP | `% GDP × GDP per resident` |

## Classification and ranking rules

- 2026 government debt is explicitly labelled `projection`.
- 2025 ODA and 2025 defence observations are labelled `estimate` because the comparison uses preliminary/current-year publication inputs.
- 2023 public social expenditure, 2024 health, 2024 tax and 2024 debt-interest observations are labelled `historical`.
- Rankings are highest USD per resident first.
- The denominator is the count of non-null comparable observations for that measure, never the fixed country-set size when coverage is narrower.
- Missing publisher coverage remains `null`, is not converted to zero and receives no rank.
- No combined national score is calculated.

## Isolation and failure behaviour

The comparison publisher writes to `v1:international-comparison:current`. It refreshes only when its seven-day due guard allows, or when no verified comparison publication exists. Source families settle independently, so one failed source makes only its affected measure unavailable. An all-source failure does not overwrite the last validated comparison publication. Deployment bootstrap queues the comparison refresh independently of the national run, so the comparison can initialise immediately without becoming a national readiness dependency.

## Public interpretation cautions

Public social expenditure overlaps with healthcare and must not be added to the healthcare row. Healthcare is total current health expenditure, not NHS-only spending. Tax revenue per resident is a country-level revenue ratio converted to a per-resident amount, not an individual's tax bill. ODA coverage uses the comparable OECD donor series, so non-covered countries must not be presented as zero-aid donors. The debt row is a forward-looking IMF projection and is visually classified as such rather than presented as an observed historical stock.
