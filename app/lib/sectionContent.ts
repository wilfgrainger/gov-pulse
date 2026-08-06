import PMApproval from "@/app/components/PMApproval";
import ElectionPolling from "@/app/components/ElectionPolling";
import BettingOdds from "@/app/components/BettingOdds";
import PolarizationMeter from "@/app/components/PolarizationMeter";
import TrendLines from "@/app/components/TrendLines";
import NationalDebtCounter from "@/app/components/NationalDebtCounter";
import GDPTracker from "@/app/components/GDPTracker";
import SentimentPulse from "@/app/components/SentimentPulse";
import TaxRevenue from "@/app/components/TaxRevenue";
import GovernmentContracts from "@/app/components/GovernmentContracts";
import EmploymentStats from "@/app/components/EmploymentStats";
import CrimeStatistics from "@/app/components/CrimeStatistics";
import NHSStats from "@/app/components/NHSStats";
import MigrationStats from "@/app/components/MigrationStats";
import EarlyYearsStats from "@/app/components/EarlyYearsStats";
import GeographicHeatmap from "@/app/components/GeographicHeatmap";
import EchoChamberMap from "@/app/components/EchoChamberMap";

export const SECTION_CONTENT = {
  "pm-approval": {
    category: "Politics",
    tag: "Withdrawn polling evidence",
    title: "Prime minister approval",
    subtitle: "No current series is shown until a reproducible primary-poll method is available.",
    component: PMApproval,
  },
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
  },
  "govt-approval": {
    category: "Politics",
    tag: "Withdrawn derived evidence",
    title: "Polarisation measure",
    subtitle: "No current score is shown because the former inputs and calculation were not reproducible.",
    component: PolarizationMeter,
  },
  "gov-trust-trend": {
    category: "Politics",
    tag: "Withdrawn polling evidence",
    title: "Government satisfaction",
    subtitle: "The former hard-coded trend and event annotations have been withdrawn.",
    component: TrendLines,
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
  "government-contracts": {
    category: "Public money",
    tag: "Official procurement notices",
    title: "Government contracts",
    subtitle: "The 100 largest comparable Find a Tender award disclosures, with independent scrutiny.",
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
  "early-years": {
    category: "Society",
    tag: "Official data",
    title: "Early Years",
    subtitle: "Child vaccination and development indicators in England.",
    component: EarlyYearsStats,
  },
  "uk-regions": {
    category: "Data",
    tag: "Withdrawn derived evidence",
    title: "UK regional comparison",
    subtitle: "The former hard-coded values and non-standard geographies have been withdrawn.",
    component: GeographicHeatmap,
  },
  "policy-links": {
    category: "Data",
    tag: "Withdrawn derived evidence",
    title: "Policy relationships",
    subtitle: "No current matrix is shown because the former inputs and method were not reproducible.",
    component: EchoChamberMap,
  },
} as const;
