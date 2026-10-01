# North Star — public-data.org

> Historical brief, superseded for the user-authorized 1 October 2026
> reinvention. Its calm-style, dashboard/analytics and architectural expansion
> prohibitions do not constrain that programme. Preserve its evidence,
> accessibility and free-only principles. See `AGENTS.md` and the proposed
> `docs/superpowers/specs/2026-10-01-publication-reinvention-design.md`.

> DRAFT planning document. Written into `_planning-drafts/` only; changes no existing repo file.
> Grounded in `AGENTS.md` (operating contract) and `docs/delivery/public-data-v3/README.md` (v3 delivery contract).

## The enduring goal

**For a first-time UK reader, public-data.org answers four questions about any public
measure within the first minute, and never at the cost of the evidence being true:**

1. **What changed?**
2. **How current is the evidence?**
3. **Why does it matter?**
4. **Where did the number come from?**

Everything the product does is judged against those four questions plus one constraint:
a reader must be able to *verify* every answer through a direct primary source, and an
answer that cannot be proved must fail closed rather than be invented.

This is not a dashboard, a scorecard, or an analytics product. It is a calm, independent,
**fail-closed UK public-evidence service** whose competitive moat is trustworthiness: it
refuses to show a number it cannot stand behind.

## What "good" looks like

- Every public claim states: what changed, why it matters, what was measured, the
  observation period, geography, unit, publication date, the direct primary source, and
  the material revision/uncertainty caveat. (`AGENTS.md`, `core-editorial-contract` audit.)
- Each measure carries **its own** clock and provenance. A successful fetch of one field
  never makes a neighbouring value look current (the series-level-provenance discipline).
- Charts use publication points, explicit units, restrained colour, accessible text
  alternatives, mobile reflow at 360px, and reduced-motion behaviour. No smoothing,
  interpolation, decoration, or combining of materially different units.
- The architecture stays small and Cloudflare-first: the OpenNext web Worker serves the
  request-time app; the data Worker exposes exactly three public routes
  (`/data/metrics-snapshot.json`, `/data/health.json`,
  `/data/international-comparison.json`); Cron + Queue + KV own recurring collection;
  Cloudflare Pages is a bounded seed/fallback only. GitHub Actions tests, builds and
  deploys — it does not collect data.
- The whole plane runs inside the Cloudflare Free allowance and adds no paid product,
  analytics, cookies, or personal-data collection.

## North-star capability: automated evidence onboarding with accessible charts

A durable aim, larger than any single feed: **onboarding a new evidence source should be a
bounded, repeatable, contract-driven operation, not a bespoke build each time.**

- A new source is added by declaring a registry entry (`worker/feed-registry.js`) plus a
  source-specific connector and a contract test — reusing the existing ONS-CSV / discovery
  / reconciliation machinery wherever the publisher allows.
- Every onboarded measure ships an accessible, **publication-point** chart: explicit unit,
  observation period, screen-reader data table, keyboard access, visible focus,
  reduced-motion, mobile reflow. No new charting family or dependency per source.
- Onboarding proves observation period, unit, geography, transformation and revision
  status before a value is ever displayed, and fails closed when it cannot.
- The reader gets the same four-question answer for a newly onboarded measure as for a
  founding one — no measure is second-class.

The measure of success is that adding "real-terms pay" or "house price index" is a
registry entry + connector + test + accessible chart, reviewed against the same evidence
bar, with no new infrastructure and no weakening of the fail-closed boundary.

## NON-GOALS (hard guardrails — an autonomous loop must not drift past these)

These are not "later" items. They are permanent prohibitions derived from `AGENTS.md` and
the v3 contract. Any change, human or automated, that moves toward one of these is wrong by
definition and must be rejected in review.

1. **Never synthesise a value.** A missing, stale, incomplete, ambiguous or unreconciled
   value is `null`/unavailable — **never** zero, a forecast, an interpolation, a smoothed
   line, or a synthetic replacement.
2. **Never combine sources to manufacture a trend.** Official statistics, administrative
   data, polling and market signals stay editorially separate and are never joined to
   imply one movement.
3. **Never publish a combined or synthetic total/score.** No combined crime total, no
   combined national score, no `overallScore` on the international comparison. The seven
   comparison measures stay separate.
4. **Never let a technical check renew evidence age.** A successful retrieval of unchanged
   data does not create a newer observation or edition date. Statistical expiry, not
   retrieval time, governs public validity.
5. **Never present retained evidence as current past its window.** A previously verified
   value survives only inside its own currentness window; otherwise it is removed and shown
   as honestly unavailable/degraded. A degraded edition declares `publicationState:
   "degraded"` and an exact `missingRequiredSections` manifest, and `/data/health.json`
   reports `ready: false`.
6. **Never expand the public surface or the plane.** No new public Worker route, no
   wildcard `/data/*`, no browser-to-collector calls, no exposed cache keys or secrets, no
   Vercel or paid Cloudflare product, no tracking or personal-data collection — without an
   explicit recorded architecture decision.
7. **Never assert interpretation as fact.** Spending is not labelled waste/fraud/saving,
   ideological labels are not ground truth, and stakeholder reactions are attributed, not
   asserted.
8. **Never weaken accessibility or the static-first fallback** to ship a feature. Semantic
   HTML, keyboard access, visible focus, reduced-motion and no-JS usefulness are
   non-negotiable.

If a proposed step requires violating any item above to work, the step is out of scope and
the underlying assumption is wrong — stop and re-root, do not patch around the guardrail.
