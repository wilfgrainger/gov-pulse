export type EvidenceSearchItem = {
  id: string;
  title: string;
  category: string;
  evidenceClass: string;
  description: string;
  href: string;
  aliases: readonly string[];
  questions: readonly string[];
  priority: number;
};

export const EVIDENCE_SEARCH_ITEMS: readonly EvidenceSearchItem[] = [
  {
    id: "key-indicators",
    title: "Prices, rates and jobs",
    category: "Economy",
    evidenceClass: "Official statistics and Bank of England decision",
    description: "CPI inflation, Bank Rate and unemployment, each kept on its own observation and publication clock.",
    href: "/section/economy",
    aliases: ["inflation", "CPI", "Bank Rate", "interest rates", "unemployment", "cost of living", "prices", "labour market", "jobs and prices"],
    questions: ["What is UK inflation?", "What is Bank Rate?", "Is unemployment rising?", "How is the cost of living changing?"],
    priority: 1,
  },
  {
    id: "gdp",
    title: "GDP",
    category: "Economy",
    evidenceClass: "Official monthly national accounts",
    description: "The latest ONS monthly and rolling three-month estimate of UK economic output.",
    href: "/section/gdp",
    aliases: ["growth", "economy growing", "economic output", "recession", "gross domestic product"],
    questions: ["Is the UK economy growing?", "Has GDP increased or fallen?", "Is the UK in recession?"],
    priority: 2,
  },
  {
    id: "employment",
    title: "Employment",
    category: "Economy",
    evidenceClass: "Official labour-market statistics",
    description: "Employment, unemployment, economic inactivity and vacancies from named official series.",
    href: "/section/employment",
    aliases: ["jobs", "workers", "vacancies", "economic inactivity", "labour force", "unemployment count"],
    questions: ["How many people are in work?", "How many job vacancies are there?", "How many people are economically inactive?"],
    priority: 3,
  },
  {
    id: "national-debt",
    title: "National debt",
    category: "Economy",
    evidenceClass: "Official monthly public-finance statistics",
    description: "Public sector net debt excluding public sector banks, with publication date and revision status.",
    href: "/section/national-debt",
    aliases: ["public debt", "government debt", "PSND", "debt to GDP", "public finances", "how much does the UK owe"],
    questions: ["How much is UK national debt?", "What percentage of GDP is the debt?", "When was the debt figure published?"],
    priority: 4,
  },
  {
    id: "government-receipts",
    title: "Government receipts",
    category: "Economy",
    evidenceClass: "Official monthly public-finance statistics",
    description: "Central government receipts from the latest accepted ONS public-sector-finance release.",
    href: "/section/tax",
    aliases: ["tax receipts", "tax revenue", "government income", "central government receipts", "how much tax"],
    questions: ["How much tax does the government collect?", "What are government receipts?", "Are tax receipts rising?"],
    priority: 5,
  },
  {
    id: "nhs-waiting-times",
    title: "NHS waiting times",
    category: "Public services",
    evidenceClass: "NHS England referral-to-treatment statistics",
    description: "The latest accepted monthly referral-to-treatment waiting-list publication for NHS England.",
    href: "/section/nhs",
    aliases: ["NHS waiting list", "hospital waiting list", "RTT", "referral to treatment", "elective care", "18 weeks"],
    questions: ["How large is the NHS waiting list?", "How long are patients waiting?", "What is referral to treatment?"],
    priority: 6,
  },
  {
    id: "migration",
    title: "Migration",
    category: "Population",
    evidenceClass: "Official ONS long-term international migration estimate",
    description: "Immigration, emigration and net migration from one reconciled official estimate.",
    href: "/section/migration",
    aliases: ["net migration", "immigration", "emigration", "people moving to the UK", "population change"],
    questions: ["What is UK net migration?", "How many people immigrated to the UK?", "How many people emigrated from the UK?"],
    priority: 7,
  },
  {
    id: "election-polling",
    title: "Election polling",
    category: "Politics and opinion",
    evidenceClass: "Verified primary pollster publication",
    description: "A named voting-intention poll with method and fieldwork dates, without a synthetic average or forecast.",
    href: "/section/election-polls",
    aliases: ["voting intention", "opinion poll", "polling", "political parties", "general election poll"],
    questions: ["What does the latest verified poll report?", "Which party is ahead in the poll?", "When was the poll fieldwork?"],
    priority: 8,
  },
  {
    id: "sources",
    title: "Sources, dates and methods",
    category: "Evidence register",
    evidenceClass: "Publication, freshness and provenance metadata",
    description: "See which evidence is current, unavailable or withdrawn and follow the primary publisher links.",
    href: "/sources",
    aliases: ["sources", "methodology", "freshness", "publication date", "update date", "provenance", "withdrawn evidence"],
    questions: ["Where did this number come from?", "When was the evidence updated?", "Which sections are unavailable?"],
    priority: 9,
  },
] as const;

export function normalizeEvidenceSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9£%]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreItem(item: EvidenceSearchItem, normalizedQuery: string, queryTokens: string[]) {
  const title = normalizeEvidenceSearchText(item.title);
  const category = normalizeEvidenceSearchText(item.category);
  const evidenceClass = normalizeEvidenceSearchText(item.evidenceClass);
  const description = normalizeEvidenceSearchText(item.description);
  const aliases = item.aliases.map(normalizeEvidenceSearchText);
  const questions = item.questions.map(normalizeEvidenceSearchText);
  const searchable = [title, category, evidenceClass, description, ...aliases, ...questions].join(" ");

  let score = 0;
  if (title === normalizedQuery) score = Math.max(score, 1_000);
  if (aliases.includes(normalizedQuery)) score = Math.max(score, 950);
  if (questions.includes(normalizedQuery)) score = Math.max(score, 925);
  if (title.startsWith(normalizedQuery)) score = Math.max(score, 850);
  if (aliases.some((alias) => alias.startsWith(normalizedQuery))) score = Math.max(score, 800);
  if (title.includes(normalizedQuery)) score = Math.max(score, 750);
  if (aliases.some((alias) => alias.includes(normalizedQuery))) score = Math.max(score, 700);
  if (questions.some((question) => question.includes(normalizedQuery))) score = Math.max(score, 675);
  if (category.includes(normalizedQuery)) score = Math.max(score, 550);
  if (evidenceClass.includes(normalizedQuery)) score = Math.max(score, 525);
  if (description.includes(normalizedQuery)) score = Math.max(score, 500);

  const matchedTokens = queryTokens.filter((token) => searchable.includes(token));
  if (queryTokens.length > 0 && matchedTokens.length === queryTokens.length) {
    score = Math.max(score, 400 + queryTokens.length * 25);
  } else if (queryTokens.length === 1 && matchedTokens.length === 1) {
    score = Math.max(score, 120);
  }

  return score;
}

export function searchEvidence(query: string, limit = 8) {
  const normalizedQuery = normalizeEvidenceSearchText(query);
  if (!normalizedQuery) return [];

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  return EVIDENCE_SEARCH_ITEMS.map((item) => ({
    item,
    score: scoreItem(item, normalizedQuery, queryTokens),
  }))
    .filter((result) => result.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.item.priority !== right.item.priority) return left.item.priority - right.item.priority;
      return left.item.title.localeCompare(right.item.title, "en-GB");
    })
    .slice(0, Math.max(0, limit))
    .map((result) => result.item);
}
