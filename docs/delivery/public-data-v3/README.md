# public-data.org v3 delivery contract

## Mission

For a first-time UK reader, make public-data.org answer four questions within the first minute:

1. What changed?
2. How current is the evidence?
3. Why does it matter?
4. Where did the number come from?

The redesign must preserve the existing fail-closed evidence contracts and Cloudflare-first publication architecture.

## Requirements

- **V3-R1 — First-visit clarity:** the homepage states the publication purpose, current-edition status and evidence rules before secondary content.
- **V3-R2 — Editorial hierarchy:** one lead publication is visually dominant; separate signals remain separate and retain their own clocks.
- **V3-R3 — Trust beside the number:** period, publication date, evidence class, caveat and direct evidence access remain close to important figures.
- **V3-R4 — Navigable on any device:** search, primary topics, all topics and sources are reachable by keyboard and reflow at 360px without horizontal page overflow.
- **V3-R5 — Honest degraded states:** unavailable or update-due evidence is visually distinct and never replaced by an estimate, zero or synthetic score.
- **V3-R6 — Coherent publication shell:** homepage, source register and section pages use one restrained visual system and consistent reading widths.
- **V3-R7 — Static-first resilience:** the server-rendered publication remains useful if browser refresh or JavaScript fails.
- **V3-R8 — Architecture preservation:** no change to source ownership, Worker routes, Cron, Queue, KV, publication completeness or freshness rules.

## Non-goals

- new data feeds, synthetic scores or cross-definition trends;
- Worker, Queue, KV or Cloudflare control-plane redesign;
- analytics, cookies, personal-data collection or paid services;
- decorative real-time counters or claims stronger than the source evidence;
- framework, charting or dependency replacement.

## Architecture decision

**Decision:** retain the existing Next.js static application and data contracts, then create v3 as a presentation-layer release built from reusable editorial tokens and existing evidence selectors.

**Reason:** the dominant constraint is comprehension and trust, not data availability or rendering technology. A backend rewrite would add migration and reliability risk while leaving the first-visit problem unsolved.

**Consequences:**

- `SectionNav` becomes one compact masthead with quick links plus accessible Topics and Search panels.
- `HomepageIntro` becomes the publication promise and reading guide.
- `NationalEvidenceEdition` remains the sole selector-backed national summary but receives stronger edition, lead-story and signal hierarchy.
- `PageHeader`, section downloads, source cards and the footer adopt the same editorial system.
- Existing IDs, public routes, source links and static-first fallback behaviour remain stable.

**Owner:** Richard Hendricks for architecture; Dinesh for implementation; Jared for scope and release.

**Revisit when:** user research shows the evidence hierarchy is still misunderstood, or a required journey cannot be supported without changing the information model.

## Verification map

| Requirement | Proof |
|---|---|
| V3-R1, R2, R3 | component tests and static homepage build |
| V3-R4 | navigation tests, keyboard behaviour and Playwright mobile/desktop journeys |
| V3-R5 | existing evidence-state tests plus unchanged fail-closed selectors |
| V3-R6 | visual-system contract and section/source component tests |
| V3-R7 | static production build and deterministic browser tests |
| V3-R8 | architecture and source-ownership repository gates; no Worker/data-plane diff |

## Team reconciliation

- **Jared:** large release, narrow mission; no data-platform expansion.
- **Richard:** publication architecture, not dashboard decoration.
- **Dinesh:** complete first-visit, topic, source and degraded-state paths.
- **Gilfoyle:** no false live language, no hidden controls, no weakened fallback or route contracts.
- **Jian-Yang:** trust claims must be inspectable and unavailable evidence must remain visibly unavailable.
- **Erlich:** plain-English first value before methodology; original sources remain one action away.
- **Graphite Mountain final simplification:** use existing selectors and components; add no new dependency or abstraction family.
