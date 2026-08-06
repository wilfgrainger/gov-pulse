import WithdrawnEvidence from "@/app/components/WithdrawnEvidence";

export default function PMApproval() {
  return (
    <WithdrawnEvidence
      titleId="pm-approval-unavailable-title"
      eyebrow="Prime minister approval polling"
      title="No current PM approval series is published by public-data.org."
      summary="The previous chart was withdrawn because the embedded figures could not be reproduced from one consistent primary polling series with complete fieldwork, sample and question disclosures. No approval number is being inferred, averaged or carried forward."
      requirements={[
        "Every observation must link to a first-party poll publication and retain fieldwork dates, sample, geography, question wording and methodology.",
        "Different pollsters or differently worded questions must be shown separately unless a documented and tested aggregation method exists.",
        "The latest observation and every historical point must use the same named measure or disclose a comparability break.",
        "Freshness, uncertainty and withdrawal rules must be enforced in code and covered by deterministic tests.",
      ]}
    />
  );
}
