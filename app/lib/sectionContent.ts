import ElectionPolling from "@/app/components/ElectionPolling";
import BettingOdds from "@/app/components/BettingOdds";
import NationalDebtCounter from "@/app/components/NationalDebtCounter";
import GDPTracker from "@/app/components/GDPTracker";
import SentimentPulse from "@/app/components/SentimentPulse";
import TaxRevenue from "@/app/components/TaxRevenue";
import GovernmentContracts from "@/app/components/GovernmentContracts";
import InternationalComparison from "@/app/components/InternationalComparison";
import EmploymentStats from "@/app/components/EmploymentStats";
import CrimeStatistics from "@/app/components/CrimeStatistics";
import NHSStats from "@/app/components/NHSStats";
import MigrationStats from "@/app/components/MigrationStats";
import HousePriceIndex from "@/app/components/HousePriceIndex";
import RealWages from "@/app/components/RealWages";
import EarlyYearsStats from "@/app/components/EarlyYearsStats";

export const SECTION_CONTENT = {
  "election-polls": {
    category: "Politics",
    tag: "Primary polling evidence",
    title: "Election polling",
    subtitle: "Verified pollster publications, shown individually without a synthetic average.",
    component: ElectionPolling,
    dataSection: "electionPolling",
  },
  "betting-odds": {
    category: "Politics",
    tag: "Commercial market signal",
    title: "Betting markets",
    subtitle: "Three named Oddschecker markets with raw reciprocal prices.",
    component: BettingOdds,
    dataSection: "bettingOdds",
  },
  "national-debt": {
    category: "Economy",
    tag: "Official monthly data",
    title: "National debt",
    subtitle: "UK public sector net debt from the latest published observation.",
    component: NationalDebtCounter,
    dataSection: "nationalDebt",
  },
  gdp: {
    category: "Economy",
    tag: "Official monthly data",
    title: "GDP",
    subtitle: "The latest ONS monthly and three-month GDP movements.",
    component: GDPTracker,
    dataSection: "gdpTracker",
  },
  economy: {
    category: "Economy",
    tag: "Series-level official data",
    title: "Key indicators",
    subtitle: "Three official series, each with its own observation and publication date.",
    component: SentimentPulse,
    dataSection: "sentimentPulse",
  },
  tax: {
    category: "Economy",
    tag: "Official monthly data",
    title: "Government receipts",
    subtitle: "Central government receipts from the latest ONS release.",
    component: TaxRevenue,
    dataSection: "taxRevenue",
  },
  "house-price-index": {
    category: "Economy",
    tag: "Official monthly data",
    title: "House prices",
    subtitle: "Average UK house price and annual house price inflation.",
    component: HousePriceIndex,
    dataSection: "housePriceIndex",
  },
  "uk-in-context": {
    category: "Public money",
    tag: "International comparison",
    title: "UK in context",
    subtitle: "Debt, aid, defence, welfare, healthcare, tax and debt interest compared per resident across a fixed 13-country group.",
    component: InternationalComparison,
  },
  "government-contracts": {
    category: "Public money",
    tag: "Official procurement notices",
    title: "Government contracts",
    subtitle: "The largest comparable Find a Tender award disclosures, with independent scrutiny.",
    component: GovernmentContracts,
  },
  employment: {
    category: "Economy",
    tag: "Official labour-market data",
    title: "Employment",
    subtitle: "Employment, unemployment, economic inactivity and vacancies.",
    component: EmploymentStats,
    dataSection: "employmentStats",
  },
  "crime-stats": {
    category: "Society",
    tag: "Modular official evidence",
    title: "Crime statistics",
    subtitle: "Crime Survey estimates, police-recorded offences and court timeliness shown as separate evidence systems.",
    component: CrimeStatistics,
    dataSection: "crimeStatistics",
  },
  nhs: {
    category: "Society",
    tag: "Official NHS England data",
    title: "NHS waiting times",
    subtitle: "Referral-to-treatment figures from the latest monthly publication.",
    component: NHSStats,
    dataSection: "nhsStats",
  },
  migration: {
    category: "Society",
    tag: "Official ONS estimate",
    title: "Migration",
    subtitle: "Long-term immigration, emigration and net migration.",
    component: MigrationStats,
    dataSection: "migrationStats",
  },
  "real-wages": {
    category: "Economy",
    tag: "Official monthly data",
    title: "Real wages",
    subtitle: "ONS's own real-terms (CPIH-adjusted) earnings growth figure.",
    component: RealWages,
    dataSection: "realWages",
  },
  "early-years": {
    category: "Society",
    tag: "Official data",
    title: "Early Years",
    subtitle: "Child vaccination and development indicators in England.",
    component: EarlyYearsStats,
  },

} as const;
