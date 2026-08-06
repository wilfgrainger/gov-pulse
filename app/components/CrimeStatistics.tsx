"use client";

import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";
import { isCurrentCrimeStatisticsPayload } from "@/contracts/crime-statistics";

const FALLBACK = {
  available: false,
  headline: {
    publisher: "",
    publicationTitle: "",
    publicationUrl: "",
    period: "",
    observedAt: "",
    releaseDate: "",
    nextReleaseDate: "",
    geography: "",
  },
  crimeSurvey: { status: "unavailable", measures: [] },
  policeRecorded: { status: "unavailable", measures: [] },
  justice: { status: "unavailable", measures: [] },
  regional: { status: "unavailable", title: "Regional comparisons", reason: "" },
  evidencePolicy: {
    combinedTotalAllowed: false,
    modulesValidatedIndependently: true,
    regionalRankingPublished: false,
  },
};

type Measure = {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  unit: string;
  changeLabel: string;
};

type EvidenceModule = {
  status: "available";
  title: string;
  sourceLabel: string;
  sourceUrl?: string;
  period?: string;
  releaseDate?: string;
  summary: string;
  caveat: string;
  measures: Measure[];
};

type CrimePayload = typeof FALLBACK & {
  crimeSurvey: EvidenceModule;
  policeRecorded: EvidenceModule;
  justice: EvidenceModule;
  regional: { status: "unavailable"; title: string; reason: string };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${value}T00:00:00Z`));
}

function EvidenceTable({ module }: { module: EvidenceModule }) {
  return (
    <div className="overflow-x-auto border-y border-black/20">
      <table className="min-w-full divide-y divide-black/15 text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-600">
          <tr>
            <th scope="col" className="px-5 py-3">Measure</th>
            <th scope="col" className="px-5 py-3 text-right">Latest figure</th>
            <th scope="col" className="px-5 py-3">Change and context</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10 bg-white">
          {module.measures.map((measure) => (
            <tr key={measure.id}>
              <th scope="row" className="px-5 py-4 font-semibold">{measure.label}</th>
              <td className="px-5 py-4 text-right font-mono font-semibold tabular-nums">
                {measure.displayValue}
                <span className="mt-1 block font-sans text-xs font-normal text-gray-600">
                  {measure.unit}
                </span>
              </td>
              <td className="px-5 py-4 text-gray-700">{measure.changeLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModuleSection({
  eyebrow,
  module,
  sourceUrl,
  sourceDate,
}: {
  eyebrow: string;
  module: EvidenceModule;
  sourceUrl: string;
  sourceDate: string;
}) {
  return (
    <section aria-labelledby={`${module.measures[0].id}-title`} className="space-y-5">
      <div className="border-b border-black/15 pb-3">
        <p className="text-sm font-semibold text-accent">{eyebrow}</p>
        <h3 id={`${module.measures[0].id}-title`} className="mt-1 text-2xl font-semibold">
          {module.title}
        </h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-700">{module.summary}</p>
      </div>

      <EvidenceTable module={module} />

      <CoreEvidenceExplanation
        idPrefix={module.measures[0].id}
        why={<p>{module.summary}</p>}
        definition={<p>{module.caveat}</p>}
        unit="Each row uses its own labelled unit"
        geography="England and Wales"
        interpretation={<p>Read this module independently. Figures from other crime and justice systems are not added to it.</p>}
        caveat={<p>{module.caveat}</p>}
        sourceLabel={module.sourceLabel}
        sourceUrl={sourceUrl}
        sourceDate={sourceDate}
      />
    </section>
  );
}

export default function CrimeStatistics() {
  const metrics = useMetrics("crimeStatistics", FALLBACK);
  const valid =
    metrics.isLive &&
    metrics.cacheState === "fresh" &&
    metrics.observationStatus === "current" &&
    isCurrentCrimeStatisticsPayload(metrics.data);

  if (!valid) {
    return (
      <>
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Crime statistics temporarily unavailable</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            The page only publishes a versioned official release that passes separate contracts for survey, police-recorded and court evidence. It does not fall back to the former bundled dataset.
          </p>
        </section>
        <MetricsStatus section="crimeStatistics" status={metrics} />
      </>
    );
  }

  const crimeData = metrics.data as CrimePayload;
  const publicationUrl = crimeData.headline.publicationUrl;

  return (
    <div className="space-y-10">
      <section aria-labelledby="crime-briefing-title" className="border-y border-foreground py-6">
        <p className="text-sm font-semibold text-accent">Latest official release</p>
        <h3
          id="crime-briefing-title"
          className="mt-2 max-w-5xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
        >
          Crime needs two different lenses, not one synthetic total.
        </h3>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-gray-700">
          The Crime Survey estimates experiences that may never be reported to police. Police records are more useful for some lower-volume, higher-harm offences. public-data.org now shows those sources separately and labels court timeliness as a third, different system measure.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {crimeData.headline.publicationTitle} · released {formatDate(crimeData.headline.releaseDate)} · next scheduled ONS release {formatDate(crimeData.headline.nextReleaseDate)}.
        </p>
      </section>

      <ModuleSection
        eyebrow="Crime Survey for England and Wales"
        module={crimeData.crimeSurvey}
        sourceUrl={publicationUrl}
        sourceDate={`Released ${formatDate(crimeData.headline.releaseDate)} · ${crimeData.headline.period}`}
      />

      <ModuleSection
        eyebrow="Home Office police records"
        module={crimeData.policeRecorded}
        sourceUrl={publicationUrl}
        sourceDate={`Published by ONS on ${formatDate(crimeData.headline.releaseDate)} · ${crimeData.headline.period}`}
      />

      <ModuleSection
        eyebrow="Ministry of Justice"
        module={crimeData.justice}
        sourceUrl={crimeData.justice.sourceUrl ?? ""}
        sourceDate={`Released ${formatDate(crimeData.justice.releaseDate ?? "")} · ${crimeData.justice.period}`}
      />

      <section aria-labelledby="regional-crime-title" className="border-l-4 border-foreground pl-4">
        <p className="text-sm font-semibold text-accent">Not yet published</p>
        <h3 id="regional-crime-title" className="mt-1 text-xl font-semibold">
          {crimeData.regional.title}
        </h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-700">
          {crimeData.regional.reason}
        </p>
      </section>

      <section aria-labelledby="crime-boundary-title" className="border-y border-black/20 py-5">
        <h3 id="crime-boundary-title" className="text-lg font-semibold">Evidence boundary</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-700">
          No victimisation estimate, recorded-offence count or court-duration figure is added to another. The page contains no inferred “total crime” and no regional ranking carried over from the retired seed.
        </p>
      </section>

      <MetricsStatus section="crimeStatistics" status={metrics} />
    </div>
  );
}
