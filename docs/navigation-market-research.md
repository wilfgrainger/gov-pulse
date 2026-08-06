# Navigation Market Research (UK public-data dashboards)

## Scope
Reviewed common IA and navigation patterns in high-trust, data-heavy products to inform this dashboard's mobile navigation.

## References reviewed
- Financial Times data interactives
- ONS statistical dashboards
- UK Parliament and GOV.UK statistics landing structures
- Reuters graphics packages

## Patterns that consistently perform well
1. **Category-first wayfinding on mobile**
   - Mobile headers typically show the current **section/category**, not an individual chart title.
   - This reduces confusion when the first card has a very specific label.

2. **Shallow section jump links near page top**
   - Data products commonly provide quick links to broad sections (Politics, Economy, Society), then secondary links to individual charts.

3. **Progressive disclosure in menus**
   - Best practice is: category first, then chart-level links inside collapsible groups.

4. **Dedicated URL strategy for major sections**
   - Mature products often move to separate section URLs once content exceeds ~8-10 cards on a single page.
   - Benefits: better shareability, clearer analytics, and less cognitive load.

## Recommendation for PULSE
- **Now (implemented):**
  - Show active category in mobile nav status area.
  - Provide quick section jump links above the dashboard and in mobile menu.
- **Next iteration:**
  - Introduce dedicated section routes (`/politics`, `/economy`, `/society`, `/data`) reusing current card components.
