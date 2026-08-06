# Fix Active Card Text Contrast on SentimentPulse

Written against: 5ab09c32965aba0365ecc94159d02f12907c04e6

## Evidence chain

- Surface: `/section/economy` (Key economic indicators dashboard panel)
- Problem: Selection (active state) of the Bank Rate indicator results in black text on a black background, rendering the primary rate value ("3.75%") completely invisible.
- Design evidence: [AGENTS.md](file:///AGENTS.md) (Chart and design rules: "restrained color", "feel sober and editorial"). High-contrast readability is a core requirement for a professional evidence service.
- Owner: `app/components/SentimentPulse.tsx`
- Scope and affected surfaces: `app/components/SentimentPulse.tsx` (the Cost of living and key indicators section on the home page)
- Uncertainty: None. The contrast collision is a direct result of inline style evaluation: `active ? entry.color : "#111111"`, where `entry.color` is `#000000`.

## Design decision

Unify the active state of all cards in the `SentimentPulse` selection grid. When active, all card values should be rendered in clean, high-contrast bright white (`text-white`) instead of applying the indicator's custom series color (which can be black or dark gray, e.g. `#000000` or `#666666`). The series color is still fully utilized in the time-series chart lines and details.

## Reuse

- Tailwind utility class: `text-white`
- Tailwind utility class: `text-gray-300` (for secondary labels in the active card)
- Exemplar: [NHSStats.tsx](file:///app/components/NHSStats.tsx) card header styling or existing active background style wrapper in `SentimentPulse.tsx`.

## Changes

1. `app/components/SentimentPulse.tsx`
   - Change: Update the main value span (`className` and `style` attributes) around line 247 so that it gets the `text-white` class when active and unsets the inline `style={{ color: entry.color }}` override.
   - Preserve: Valid selection click behaviors (`onClick={() => setMetric(id)}`), active status tracking (`aria-pressed={active}`), and structural layout.
   - Verify: The text "3.75%" is visible in white when Bank Rate is active.

## Scope

- Inherit: All indicator cards in the SentimentPulse block.
- Verify: Inflation card (active red), Bank Rate card (active black), and Unemployment card (active dark gray) are all legible in their selected states.
- Exclude: None.

## Validation

- Product: Selecting any card (Inflation, Bank Rate, Unemployment) clearly displays the metric value in high-contrast text.
- Interface: Verify contrast across mobile/desktop layouts on the main dashboard `/`.
- System: No parallel inline color definitions created.
- Repository: `npm run test` → all tests pass.

## Stop conditions

- Stop if the schema structure in the cached dataset changes the colors of series keys.

## Design documentation

- After acceptance and validation: None.
