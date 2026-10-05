# Publication controls

Edit `config/publications.json`. Each publication has an independent `enabled`
boolean. Keep a source disabled until its publisher edition and reader-facing
output have been reverified; then enable only that source in a reviewed PR.
Config changes trigger the normal validated production deployment. No secrets
or dashboard access are needed to change publication visibility.

The same source switch controls topic pages, current JSON/CSV downloads,
public snapshots, embedded page data, catalog records and discovery. The
`governmentContracts` switch also controls dossiers and source-release history.
`internationalComparison` controls country comparisons. Release calendars,
static early-years evidence, authored stories and the edition archive have
their own switches. Unknown publication identifiers stay disabled.

Archive publication requires `editionArchive: { "enabled": true }` and the
source switches for any values to be shown. Disabled source values and their
revision changes are removed from archived responses too. Enabling a switch
does not bypass source validation, expiry or completeness checks.

These controls affect publication, not private stored evidence or scheduled
collection. Storage and collectors remain available for verification. A full
pause serves a review notice, blocks data deliveries with HTTP 503/no-store,
and reports `publication-paused` from the public health route.

During a full pause the public Pages seed is also replaced by a notice and
blocked data endpoints. It stays offline after a partial restoration until a
verified seed is explicitly rebuilt through the existing `refresh_pages_seed`
deployment option. Previously downloaded copies cannot be recalled.
