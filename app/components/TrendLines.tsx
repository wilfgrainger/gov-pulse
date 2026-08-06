import WithdrawnEvidence from "@/app/components/WithdrawnEvidence";

export default function TrendLines() {
  return (
    <WithdrawnEvidence
      titleId="government-satisfaction-unavailable-title"
      eyebrow="Government satisfaction polling"
      title="The government satisfaction trend has been withdrawn."
      summary="The previous chart contained hardcoded percentages from 2020 to 2025, mixed Ipsos and YouGov source claims, and event annotations that implied explanation without a reproducible series or causal method. Those values and annotations have been removed."
      requirements={[
        "Choose one named survey question and retain its exact wording, population, geography, fieldwork dates, sample and methodology for every wave.",
        "Link each observation to a first-party publication or downloadable table and record any methodology or question break.",
        "Do not merge different pollsters or satisfaction, approval and trust questions into one line without a documented and tested harmonisation method.",
        "Treat political events as a separate chronology; do not imply that an event caused a polling movement without supporting analysis.",
        "Enforce publication-date freshness, uncertainty and fail-closed behaviour before the series returns.",
      ]}
      note="public-data.org is not presenting a current satisfaction percentage, a change since 2020 or a historic-low claim."
    />
  );
}
