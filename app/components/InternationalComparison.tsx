import { readServerInternationalComparison } from "@/app/lib/serverInternationalComparison";
import {
  COMPARISON_COUNTRY_NAMES,
  COMPARISON_MEASURE_ORDER,
  exclusionLabel,
  formatUsdPerResident,
  rankLabel,
  ukObservation,
  valueTypeLabel,
  type ComparisonMeasure,
  type ComparisonObservation,
} from "@/app/lib/internationalComparison";

function sourceLine(observation: ComparisonObservation | null) {
  if (!observation?.source) return null;
  return (
    <p className="mt-3 text-xs leading-5 text-gray-600">
      Source: {" "}
      <a
        href={observation.source.url}
        className="font-semibold underline decoration-black/20 underline-offset-4 hover:text-accent"
        target="_blank"
        rel="noreferrer"
      >
        {observation.source.publisher}
      </a>
      {observation.source.series ? `, ${observation.source.series}` : ""}
      {observation.source.publicationDate
        ? `, published ${observation.source.publicationDate}`
        : ""}
      .
    </p>
  );
}

function scorecardRow(measure: ComparisonMeasure) {
  const uk = ukObservation(measure);
  return (
    <tr key={measure.id} className="border-t border-[#d8d3c8] align-top">
      <th scope="row" className="py-4 pr-4 text-left text-sm font-semibold text-[#172234]">
        <a href={`#${measure.id}`} className="underline decoration-black/20 underline-offset-4 hover:text-accent">
          {measure.label}
        </a>
      </th>
      <td className="px-2 py-4 text-sm font-semibold tabular-nums text-[#172234]">
        {formatUsdPerResident(uk?.value ?? null)}
      </td>
      <td className="px-2 py-4 text-sm text-gray-700">
        {uk ? rankLabel(measure, uk) : "Not ranked"}
      </td>
      <td className="px-2 py-4 text-sm text-gray-700">{measure.observationYear}</td>
    </tr>
  );
}

function rankedCountries(measure: ComparisonMeasure) {
  return measure.countries
    .filter((observation) => observation.value !== null)
    .sort(
      (left, right) =>
        (left.rank ?? Number.MAX_SAFE_INTEGER) -
          (right.rank ?? Number.MAX_SAFE_INTEGER) ||
        COMPARISON_COUNTRY_NAMES[left.country].localeCompare(
          COMPARISON_COUNTRY_NAMES[right.country],
          "en-GB"
        )
    );
}

function unavailableCountries(measure: ComparisonMeasure) {
  return measure.countries.filter((observation) => observation.value === null);
}

function MeasureDetail({ measure }: { measure: ComparisonMeasure }) {
  const ranked = rankedCountries(measure);
  const unavailable = unavailableCountries(measure);
  const uk = ukObservation(measure);

  return (
    <section id={measure.id} className="scroll-mt-28 border-t border-[#c8c1b5] pt-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)] lg:items-start">
        <div>
          <p className="eyebrow">{measure.observationYear} comparison</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#172234]">
            {measure.label}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">{measure.definition}</p>
          {measure.caveat ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">{measure.caveat}</p>
          ) : null}
        </div>
        <aside className="border border-[#c8c1b5] bg-[#f7f3eb] p-4" aria-label={`UK ${measure.label} summary`}>
          <p className="eyebrow">United Kingdom</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#172234]">
            {formatUsdPerResident(uk?.value ?? null)}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#8a3540]">
            {uk ? rankLabel(measure, uk) : "Not ranked"}
          </p>
          {uk ? (
            <p className="mt-2 text-xs leading-5 text-gray-600">
              {valueTypeLabel(uk.valueType)} for {uk.observationYear}. Rankings are highest amount per resident first.
            </p>
          ) : null}
          {sourceLine(uk)}
        </aside>
      </div>

      {ranked.length > 0 ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <caption className="sr-only">{measure.label} by country</caption>
            <thead>
              <tr className="border-y border-[#172234] text-xs uppercase tracking-[0.08em] text-gray-600">
                <th scope="col" className="py-3 pr-3">Rank</th>
                <th scope="col" className="px-3 py-3">Country</th>
                <th scope="col" className="px-3 py-3">USD per resident</th>
                <th scope="col" className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((observation) => (
                <tr
                  key={observation.country}
                  className={`border-b border-[#e4dfd6] ${observation.country === "GBR" ? "bg-[#f7f3eb]" : ""}`}
                >
                  <td className="py-3 pr-3 text-sm font-semibold tabular-nums text-[#172234]">
                    {observation.rank}
                  </td>
                  <th scope="row" className="px-3 py-3 text-sm font-semibold text-[#172234]">
                    {COMPARISON_COUNTRY_NAMES[observation.country]}
                  </th>
                  <td className="px-3 py-3 text-sm tabular-nums text-gray-800">
                    {formatUsdPerResident(observation.value)}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    {valueTypeLabel(observation.valueType)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 border border-[#d8d3c8] bg-[#f7f3eb] p-5">
          <p className="font-semibold text-[#172234]">Comparable figures are currently unavailable.</p>
          <p className="mt-2 text-sm leading-6 text-gray-700">
            This measure is withheld until its authoritative source can be validated. Other comparison measures continue independently.
          </p>
        </div>
      )}

      {unavailable.length > 0 ? (
        <details className="mt-4 border border-[#d8d3c8] bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#172234]">
            {unavailable.length} countr{unavailable.length === 1 ? "y" : "ies"} not included in this ranking
          </summary>
          <ul className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            {unavailable.map((observation) => (
              <li key={observation.country}>
                <span className="font-semibold text-[#172234]">
                  {COMPARISON_COUNTRY_NAMES[observation.country]}:
                </span>{" "}
                {exclusionLabel(observation.exclusionReason)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export default async function InternationalComparison() {
  const publication = await readServerInternationalComparison();

  return (
    <div>
      <div className="max-w-4xl">
        <p className="eyebrow">Selected 13-country comparison set</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#172234]">
          What does Britain spend and owe per citizen?
        </h2>
        <p className="mt-4 text-base leading-7 text-gray-700">
          Seven separate measures put the UK beside the United States, China, Russia, Ukraine and eight large European economies. Each row keeps its own definition, year and comparable-country denominator. The figures are not added together into an overall score.
        </p>
      </div>

      <div className="mt-7 border-y border-[#172234]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse">
            <caption className="sr-only">United Kingdom per-resident international comparison scorecard</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-gray-600">
                <th scope="col" className="py-3 pr-4">Measure</th>
                <th scope="col" className="px-2 py-3">UK per citizen</th>
                <th scope="col" className="px-2 py-3">UK rank</th>
                <th scope="col" className="px-2 py-3">Year</th>
              </tr>
            </thead>
            <tbody>
              {publication
                ? COMPARISON_MEASURE_ORDER.map((id) => scorecardRow(publication.measures[id]))
                : COMPARISON_MEASURE_ORDER.map((id) => (
                    <tr key={id} className="border-t border-[#d8d3c8] align-top">
                      <th scope="row" className="py-4 pr-4 text-left text-sm font-semibold text-[#172234]">
                        {id === "governmentDebt" && "Government debt outstanding"}
                        {id === "officialDevelopmentAssistance" && "Foreign / overseas aid"}
                        {id === "defenceSpending" && "Defence spending"}
                        {id === "publicSocialExpenditure" && "Public social / welfare spending"}
                        {id === "healthcareSpending" && "Total healthcare spending"}
                        {id === "taxRevenue" && "Tax collected"}
                        {id === "debtInterest" && "Debt interest"}
                      </th>
                      <td className="px-2 py-4 text-sm text-gray-600">Unavailable</td>
                      <td className="px-2 py-4 text-sm text-gray-600">Not ranked</td>
                      <td className="px-2 py-4 text-sm text-gray-600">-</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {!publication ? (
        <div className="mt-6 border border-[#d8d3c8] bg-[#f7f3eb] p-5">
          <p className="font-semibold text-[#172234]">International comparison edition not yet verified.</p>
          <p className="mt-2 text-sm leading-6 text-gray-700">
            The report remains unavailable until at least one authoritative comparison source has produced a validated publication. This does not affect the UK national evidence edition.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 text-sm leading-6 text-gray-700 sm:grid-cols-2">
            <p>
              <strong className="text-[#172234]">Ranking method:</strong> highest amount per resident first, with tied values sharing a competition rank.
            </p>
            <p>
              <strong className="text-[#172234]">Coverage:</strong> countries without a genuinely comparable observation are excluded from the denominator for that measure, never treated as zero.
            </p>
          </div>
          <div className="mt-10 space-y-10">
            {COMPARISON_MEASURE_ORDER.map((id) => (
              <MeasureDetail key={id} measure={publication.measures[id]} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
