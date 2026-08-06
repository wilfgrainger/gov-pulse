# Fix National Debt Headline Text Contrast

Written against: 441cb56170327f29bb57cbf8984950e931e9c490

## Evidence chain

- Surface: `/section/national-debt` (Public finances national debt panel)
- Problem: The headline national debt amount is rendered in dark crimson red text (`text-accent`) on a solid black background (`bg-black`), which violates basic WCAG 2.1 AA legibility guidelines due to poor contrast (~2.2:1 ratio).
- Design evidence: [AGENTS.md](file:///AGENTS.md) (Chart and design rules: "restrained color", "feel sober and editorial"). High contrast is required to keep typography legible.
- Owner: `app/components/NationalDebtCounter.tsx`
- Scope and affected surfaces: `app/components/NationalDebtCounter.tsx` (the national debt value box)
- Uncertainty: None. The contrast collision is a direct result of placing the crimson `#8a3540` accent color on a pure black background.

## Design decision

Change the CSS text color class of the headline net debt stock value from `text-accent` to `text-white`. This ensures high-contrast readability against the black background and aligns it with the text colors of the surrounding labels in the container.

## Reuse

- Tailwind utility class: `text-white`
- Exemplar: [NationalSignalsOverview.tsx](file:///app/components/NationalSignalsOverview.tsx) start here card title or overview container.

## Changes

1. `app/components/NationalDebtCounter.tsx`
   - Change: Replace `text-accent` with `text-white` on the headline tag (`<h3 id="national-debt-value">`) around line 113.
   - Preserve: Numeric formatting (`formatDebt(debtValue)`), layouts, labels, and observation period displays.
   - Verify: The text is visible in clean white color against the black card background.

## Scope

- Inherit: National Debt value container.
- Verify: The national debt page `/section/national-debt`.
- Exclude: None.

## Validation

- Product: The national debt amount is perfectly legible in high-contrast text.
- Interface: Verify layout across narrow viewport sizes.
- System: Clean reuse of standard text color properties.
- Repository: `npm run test` → all tests pass.

## Stop conditions

- None.

## Design documentation

- After acceptance and validation: None.
