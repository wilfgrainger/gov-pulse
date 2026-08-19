export interface SectionItem {
  id: string;
  label: string;
  shortLabel?: string;
}

export interface CategoryGroup {
  category: string;
  sections: SectionItem[];
}

export const WITHDRAWN_SECTION_IDS = [
  "pm-approval",
  "govt-approval",
  "gov-trust-trend",
  "uk-regions",
  "policy-links",
] as const;

export const SECTIONS: CategoryGroup[] = [
  {
    category: "Politics",
    sections: [
      { id: "election-polls", label: "Election polling", shortLabel: "Polling" },
      { id: "betting-odds", label: "Betting markets", shortLabel: "Markets" },
    ],
  },
  {
    category: "Economy",
    sections: [
      { id: "national-debt", label: "National debt" },
      { id: "gdp", label: "GDP" },
      { id: "economy", label: "Key indicators", shortLabel: "Indicators" },
      { id: "tax", label: "Government receipts", shortLabel: "Receipts" },
      { id: "employment", label: "Employment" },
    ],
  },
  {
    category: "Public money",
    sections: [
      { id: "uk-in-context", label: "UK in context", shortLabel: "UK context" },
      { id: "government-contracts", label: "Government contracts", shortLabel: "Contracts" },
    ],
  },
  {
    category: "Society",
    sections: [
      { id: "nhs", label: "NHS waiting times", shortLabel: "NHS" },
      { id: "migration", label: "Migration" },
      { id: "crime-stats", label: "Crime statistics", shortLabel: "Crime" },
      { id: "early-years", label: "Early years spotlight", shortLabel: "Early years" },
    ],
  },
];
