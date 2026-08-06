import WithdrawnEvidence from "@/app/components/WithdrawnEvidence";

export default function EchoChamberMap() {
  return (
    <WithdrawnEvidence
      titleId="policy-links-unavailable-title"
      eyebrow="Derived survey analysis"
      title="The policy relationship matrix remains withdrawn."
      summary="The former matrix displayed correlation coefficients without committed respondent-level inputs, named variables, survey coverage, weighting, exclusions or a reproducible calculation. No relationship strength, ideological cluster or causal link is being inferred or carried forward."
      requirements={[
        "Publish the respondent-level or aggregate input dataset with a lawful and reusable licensing basis.",
        "Name every source variable, survey wave, sampled population, geography, weighting scheme and missing-data rule.",
        "Define the correlation or association statistic, coding, exclusions, multiple-comparison treatment and uncertainty before calculation.",
        "Keep statistical association separate from causal or political interpretation and publish sensitivity checks.",
        "Test the full transformation against fixed fixtures and expose the method and limitations beside any returned matrix.",
      ]}
    />
  );
}
