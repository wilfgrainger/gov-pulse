import WithdrawnEvidence from "@/app/components/WithdrawnEvidence";

export default function PolarizationMeter() {
  return (
    <WithdrawnEvidence
      titleId="polarization-unavailable-title"
      eyebrow="Derived public-opinion analysis"
      title="The polarization measure remains withdrawn."
      summary="The former site score had no reproducible input dataset or published calculation. A derived political measure must not look like an observed public statistic when its weighting, exclusions and uncertainty cannot be independently checked."
      requirements={[
        "Publish the poll-level or respondent-level inputs, coverage period and licensing basis.",
        "Define the formula, weighting, missing-data treatment, exclusions and sensitivity checks before calculating a score.",
        "Keep observed survey results separate from site-derived analysis and label every transformation.",
        "Test the calculation against fixed fixtures and publish uncertainty and known limitations at the point of use.",
      ]}
      note="No approval, division or polarization value is being inferred from other public-data.org polling sections."
    />
  );
}
