import WithdrawnEvidence from "@/app/components/WithdrawnEvidence";

export default function GeographicHeatmap() {
  return (
    <WithdrawnEvidence
      titleId="regional-comparison-unavailable-title"
      eyebrow="Derived regional evidence"
      title="The UK regional comparison has been withdrawn."
      summary="The former tile map embedded unemployment, recorded-crime and election values without reproducible row-level sources or standard statistical geography codes. It also mixed Scotland, Wales and Northern Ireland with English regions while using source systems that do not cover every nation on the same basis. Those values and rankings have been removed."
      requirements={[
        "Use one published measure at a time with a direct table, observation period, unit, revision status and extraction method.",
        "Identify every area with an official statistical geography code and do not invent or merge regions such as a single undifferentiated Midlands.",
        "Keep England and Wales, Scotland and Northern Ireland crime systems separate unless a publisher supplies a genuinely comparable UK series.",
        "Define election aggregation from official constituency results and publish the constituency-to-region lookup and calculation.",
        "Test every source row, geography join, ranking and unavailable state before the comparison returns.",
      ]}
      note="public-data.org is not carrying forward any regional unemployment, crime, voting or income value from the former map."
    />
  );
}
