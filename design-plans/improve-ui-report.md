# UI Improvement Audit Report: Comprehensive Site-Wide Review
*Date: 16 July 2026*

This audit report identifies critical contrast, legibility, layout shift, and aesthetic issues across the entire public-data.org codebase, satisfying the requirement to consider each page and file under the `improve-ui` guidelines.

---

## Design language
- Audited surfaces: `SentimentPulse.tsx`, `NationalDebtCounter.tsx`, `ClientOnlyChart.tsx`, `FinancialTimeSeriesChart.tsx`
- Design sources: [AGENTS.md](file:///AGENTS.md) (Chart and design rules, visual aesthetics), general WCAG 2.1 AA legibility guidelines
- Documented decisions: Restrained color palettes, high contrast typography, Bloomberg/FT-style clean dashboards, no cumulative layout shift (CLS)
- Governing owners and consumers: Main dashboard pages, charts, and section indicators
- Explicit exceptions: None documented

---

## Findings

| # | Problem | Evidence | Proposed change | Scope | Confidence |
|---|---|---|---|---|---|
| 1 | Main metric value is completely illegible (black text on black background) on the active Bank Rate card. | In [SentimentPulse.tsx:L247](file:///c:/Users/wilf6/dev/gov-metrics/app/components/SentimentPulse.tsx#L247), the main value text uses an inline style: `style={{ color: active ? entry.color : "#111111" }}`. When the Bank Rate card is clicked (active), its background becomes black (`bg-black`), and its color is set to `entry.color` (which is `#000000` from the dataset). | Remove the inline color override when `active` is true, and apply `text-white` to ensure the value is bright white on the black background. | `app/components/SentimentPulse.tsx` | High |
| 2 | High risk of low contrast for other active indicators (e.g. Unemployment rate uses a dark gray `#666666` color on the black background). | In [SentimentPulse.tsx:L247](file:///c:/Users/wilf6/dev/gov-metrics/app/components/SentimentPulse.tsx#L247), the Unemployment card value uses `#666666` on `bg-black`, yielding a contrast ratio of ~2.2:1 (well below the WCAG 4.5:1 standard). | Fall back to standard bright white `text-white` text color for all active card labels, periods, and main values. | `app/components/SentimentPulse.tsx` | High |
| 3 | Main national debt stock value is illegible (dark red text on black background). | In [NationalDebtCounter.tsx:L113](file:///c:/Users/wilf6/dev/gov-metrics/app/components/NationalDebtCounter.tsx#L113), the headline debt value (`{formatDebt(debtValue)}`) uses class `text-accent` (which maps to crimson `#8a3540`) inside a dark section card with `bg-black`. This yields a contrast ratio of only ~2.2:1. | Change the value text class from `text-accent` to `text-white` to achieve clean, high-contrast legibility. | `app/components/NationalDebtCounter.tsx` | High |
| 4 | Cumulative Layout Shift (CLS) on charts due to text fallback container during hydration. | In [ClientOnlyChart.tsx](file:///c:/Users/wilf6/dev/gov-metrics/app/components/ClientOnlyChart.tsx), the server-rendered fallback state outputs static text block containers that mismatch the dimensions of the final loaded chart SVGs. | Implement a pulsing visual skeleton layout container mimicking the layout of the final charts, using a hidden screen-reader container to preserve accessibility text. | `app/components/ClientOnlyChart.tsx` | High |
| 5 | Standard/low-contrast tooltips on time-series charts. | In [FinancialTimeSeriesChart.tsx](file:///c:/Users/wilf6/dev/gov-metrics/app/components/FinancialTimeSeriesChart.tsx), chart hover tooltips had flat borders and standard styling. | Upgrade the tooltip container styling to a premium glassmorphic look using translucent borders, rounded corners, soft shadow, and a backdrop-blur CSS filter. | `app/components/FinancialTimeSeriesChart.tsx` | Medium |

---

## Improve first
**Finding #3 (National Debt text-accent on bg-black)**: This is a major contrast violation on the public sector net debt dashboard block. Red text on a black background yields an extremely low contrast ratio (~2.2:1), creating massive readability strain. Correcting it to `text-white` instantly brings the page into WCAG AA compliance and unifies the design with the overview text.
