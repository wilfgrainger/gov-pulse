# ADR 0002: Public data publication contracts

**Status:** Accepted for the user-authorized reinvention, 1 October 2026.

## Context

The existing site used presentation-specific inventories and fixed endpoint
allowlists. Several charts and data summaries could therefore diverge from the
currentness and source evidence already collected by the Workers. Prior project
notes also encoded a restrained visual palette and barred product choices the
user has now explicitly authorized.

## Decision

Use reviewed route and measure-coverage manifests as shared inventories, then
build the publication from explicit source records with visible currentness,
units, dates and caveats. Preserve the Cloudflare Free-only requirement and
keep internal collection operations private. Prior style prohibitions are
superseded: the site may adopt a vibrant FiveThirtyEight-inspired editorial
identity while preserving keyboard access, reduced motion, and legible
contrast.

Procurement revisions are resolved across the complete bounded date window
before selecting the top 100. Postcode-area letters alone do not establish a
UK nation; use an exact publisher-provided nation name or retain
`Other/Unknown` until an address-level authoritative lookup can be verified.

The exact data Worker public surface includes two read-only edition archive
contracts, `/data/editions.json` and `/data/edition.json?edition=...`. The list
currently retains up to 60 releases, subject to evidence and measured storage
capacity; that default does not cap the product's historical depth. Lookup accepts one validated edition id and
returns its immutable historical catalog with an explicit as-of date. Both
routes must be present in `contracts/public-surfaces.json` and the Worker's
exact route table. Wildcard data ingress remains prohibited.

## Consequences

New public routes require a manifest change and a route test. Displayed measures
require a canonical coverage entry or an explicit withdrawal. Historical source
and scope notes remain available as evidence but no longer veto the authorized
reinvention. Production remains unchanged until deployment is separately
approved.
