export const MOJ_COURT_PUBLICATION = {
  status: "available",
  title: "Criminal court timeliness",
  sourceLabel: "Ministry of Justice Criminal court statistics quarterly",
  sourceUrl:
    "https://www.gov.uk/government/statistics/criminal-court-statistics-quarterly-january-to-march-2026/criminal-court-statistics-quarterly-january-to-march-2026",
  period: "January to March 2026",
  releaseDate: "2026-06-25",
  summary:
    "Median completion times increased in both magistrates’ courts and the Crown Court compared with the same quarter a year earlier.",
  caveat:
    "Court timeliness measures completed defendant cases and is backwards-looking. It must not be presented as a crime rate or combined with victimisation and recorded-offence totals.",
  measures: [
    {
      id: "magistratesChargeToCompletion",
      label: "Magistrates’ courts: charge to completion",
      value: 52,
      displayValue: "52 days",
      unit: "median days",
      changeLabel: "Up from 39 days a year earlier",
    },
    {
      id: "crownChargeToCompletion",
      label: "Crown Court: charge to completion",
      value: 183,
      displayValue: "183 days",
      unit: "median days",
      changeLabel: "Up from 180 days a year earlier",
    },
    {
      id: "crownOffenceToCompletion",
      label: "Crown Court: offence to completion",
      value: 346,
      displayValue: "346 days",
      unit: "median days",
      changeLabel: "Up from 326 days a year earlier",
    },
  ],
};
