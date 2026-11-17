/**
 * Curated directory of where people in the UK can find government data.
 *
 * This is a signposting list, not evidence: no value here is published as a
 * statistic. Each entry links to the owner's own service. `owner` keeps
 * official publishers separate from independent tools built on public data.
 * Coverage is the geography the service is built for, stated conservatively.
 */

export type DirectoryAccess = "Search" | "Download" | "API" | "Dashboard" | "Map" | "Request";
export type DirectoryCoverage = "UK" | "GB" | "England" | "England and Wales" | "Scotland" | "Wales" | "Northern Ireland";
export type DirectoryOwner = "official" | "independent";

export interface DirectoryEntry {
  readonly id: string;
  readonly name: string;
  readonly publisher: string;
  readonly url: string;
  readonly description: string;
  readonly coverage: DirectoryCoverage;
  readonly access: readonly DirectoryAccess[];
  readonly owner: DirectoryOwner;
}

export interface DirectoryCategory {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly entries: readonly DirectoryEntry[];
}

export const GOV_DATA_DIRECTORY: readonly DirectoryCategory[] = [
  {
    id: "start-here",
    title: "Start here",
    summary: "National catalogues and statistics producers. Most official datasets are listed or published through one of these.",
    entries: [
      { id: "data-gov-uk", name: "data.gov.uk", publisher: "Government Digital Service", url: "https://www.data.gov.uk/", description: "Catalogue of open datasets published by central government, local authorities and public bodies.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
      { id: "ons", name: "Office for National Statistics", publisher: "ONS", url: "https://www.ons.gov.uk/", description: "The UK's largest producer of official statistics: economy, population, labour market, prices, health and society.", coverage: "UK", access: ["Search", "Download", "API"], owner: "official" },
      { id: "gov-uk-statistics", name: "GOV.UK research and statistics", publisher: "GOV.UK", url: "https://www.gov.uk/search/research-and-statistics", description: "Search every statistical release published on GOV.UK by central government departments and agencies.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
      { id: "ons-release-calendar", name: "ONS release calendar", publisher: "ONS", url: "https://www.ons.gov.uk/releasecalendar", description: "Upcoming and recently published ONS releases with confirmed dates.", coverage: "UK", access: ["Search"], owner: "official" },
      { id: "uksa", name: "UK Statistics Authority", publisher: "UK Statistics Authority", url: "https://uksa.statisticsauthority.gov.uk/", description: "The statistics regulator. Shows which statistics are accredited official statistics and investigates concerns about their use.", coverage: "UK", access: ["Search"], owner: "official" },
    ],
  },
  {
    id: "nations",
    title: "Scotland, Wales and Northern Ireland",
    summary: "Devolved governments publish their own statistics, often with more local detail than UK-wide releases.",
    entries: [
      { id: "statistics-gov-scot", name: "statistics.gov.scot", publisher: "Scottish Government", url: "https://statistics.gov.scot/", description: "Open data platform for Scottish official statistics down to small-area level.", coverage: "Scotland", access: ["Search", "Download", "API"], owner: "official" },
      { id: "gov-scot-statistics", name: "Scottish Government statistics", publisher: "Scottish Government", url: "https://www.gov.scot/statistics/", description: "Statistical publications from the Scottish Government by topic.", coverage: "Scotland", access: ["Search", "Download"], owner: "official" },
      { id: "nrs", name: "National Records of Scotland", publisher: "National Records of Scotland", url: "https://www.nrscotland.gov.uk/", description: "Population, births, deaths, marriages and archives for Scotland.", coverage: "Scotland", access: ["Search", "Download"], owner: "official" },
      { id: "scotlands-census", name: "Scotland's Census", publisher: "National Records of Scotland", url: "https://www.scotlandscensus.gov.uk/", description: "Census results for Scotland, which runs its own census separately from England and Wales.", coverage: "Scotland", access: ["Search", "Download"], owner: "official" },
      { id: "statswales", name: "StatsWales", publisher: "Welsh Government", url: "https://statswales.gov.wales/", description: "Detailed statistical tables for Wales that can be filtered and downloaded.", coverage: "Wales", access: ["Search", "Download", "API"], owner: "official" },
      { id: "gov-wales-statistics", name: "Welsh Government statistics and research", publisher: "Welsh Government", url: "https://www.gov.wales/statistics-and-research", description: "Statistical releases and research reports from the Welsh Government.", coverage: "Wales", access: ["Search", "Download"], owner: "official" },
      { id: "nisra", name: "NISRA", publisher: "Northern Ireland Statistics and Research Agency", url: "https://www.nisra.gov.uk/", description: "Official statistics for Northern Ireland, including its census, population and labour market.", coverage: "Northern Ireland", access: ["Search", "Download"], owner: "official" },
      { id: "opendatani", name: "OpenDataNI", publisher: "Northern Ireland Executive", url: "https://www.opendatani.gov.uk/", description: "Open datasets from Northern Ireland public bodies.", coverage: "Northern Ireland", access: ["Search", "Download", "API"], owner: "official" },
    ],
  },
  {
    id: "local-area",
    title: "Your local area",
    summary: "Figures for a council, constituency, neighbourhood or postcode.",
    entries: [
      { id: "explore-local-statistics", name: "Explore local statistics", publisher: "ONS", url: "https://www.ons.gov.uk/explore-local-statistics/", description: "Find and compare headline statistics for a local area.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
      { id: "ons-census", name: "Census 2021 (England and Wales)", publisher: "ONS", url: "https://www.ons.gov.uk/census", description: "Census results, maps and custom tables for England and Wales.", coverage: "England and Wales", access: ["Search", "Download", "Map"], owner: "official" },
      { id: "nomis", name: "Nomis", publisher: "ONS", url: "https://www.nomisweb.co.uk/", description: "Labour market, benefits and census tables at local geographies.", coverage: "UK", access: ["Search", "Download", "API"], owner: "official" },
      { id: "lg-inform", name: "LG Inform", publisher: "Local Government Association", url: "https://lginform.local.gov.uk/", description: "Compare council performance and local-area data across England.", coverage: "England", access: ["Search", "Download"], owner: "official" },
      { id: "open-geography", name: "Open Geography Portal", publisher: "ONS", url: "https://geoportal.statistics.gov.uk/", description: "Official boundaries, postcode directories and geography lookups.", coverage: "UK", access: ["Download", "API", "Map"], owner: "official" },
      { id: "os-data-hub", name: "OS Data Hub", publisher: "Ordnance Survey", url: "https://osdatahub.os.uk/", description: "Ordnance Survey maps and open geographic data products.", coverage: "GB", access: ["Download", "API", "Map"], owner: "official" },
      { id: "planning-data", name: "Planning data", publisher: "Ministry of Housing, Communities and Local Government", url: "https://www.planning.data.gov.uk/", description: "Planning and housing datasets such as conservation areas and brownfield land.", coverage: "England", access: ["Search", "Download", "API", "Map"], owner: "official" },
    ],
  },
  {
    id: "economy-money",
    title: "Economy, money and business",
    summary: "Prices, interest rates, tax, public finances, companies and property.",
    entries: [
      { id: "boe-database", name: "Bank of England Database", publisher: "Bank of England", url: "https://www.bankofengland.co.uk/boeapps/database/", description: "Interest rates, exchange rates, money and lending series.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
      { id: "obr", name: "Office for Budget Responsibility", publisher: "OBR", url: "https://obr.uk/", description: "Independent economic and fiscal forecasts and supporting data.", coverage: "UK", access: ["Download"], owner: "official" },
      { id: "hmrc-statistics", name: "HMRC statistics", publisher: "HM Revenue and Customs", url: "https://www.gov.uk/government/organisations/hm-revenue-customs/about/statistics", description: "Tax receipts, income distribution, trade and benefits statistics.", coverage: "UK", access: ["Download"], owner: "official" },
      { id: "companies-house", name: "Find and update company information", publisher: "Companies House", url: "https://find-and-update.company-information.service.gov.uk/", description: "Search company records, officers, filed accounts and persons with significant control.", coverage: "UK", access: ["Search", "API"], owner: "official" },
      { id: "price-paid", name: "Price Paid Data", publisher: "HM Land Registry", url: "https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads", description: "Residential property sales in England and Wales.", coverage: "England and Wales", access: ["Download"], owner: "official" },
      { id: "ukhpi", name: "UK House Price Index", publisher: "HM Land Registry", url: "https://landregistry.data.gov.uk/app/ukhpi", description: "Average house prices and changes by area.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
      { id: "fca-register", name: "Financial Services Register", publisher: "Financial Conduct Authority", url: "https://register.fca.org.uk/", description: "Check whether a firm or individual is authorised for financial services.", coverage: "UK", access: ["Search"], owner: "official" },
      { id: "insolvency-statistics", name: "Insolvency statistics", publisher: "Insolvency Service", url: "https://www.gov.uk/government/collections/insolvency-service-official-statistics", description: "Company and individual insolvencies.", coverage: "UK", access: ["Download"], owner: "official" },
    ],
  },
  {
    id: "public-spending",
    title: "Public spending, contracts and charities",
    summary: "Where public money goes and who receives it.",
    entries: [
      { id: "contracts-finder", name: "Contracts Finder", publisher: "Crown Commercial Service", url: "https://www.contractsfinder.service.gov.uk/", description: "Public-sector contract opportunities and awards in England.", coverage: "England", access: ["Search", "Download", "API"], owner: "official" },
      { id: "find-a-tender", name: "Find a Tender", publisher: "Cabinet Office", url: "https://www.find-tender.service.gov.uk/", description: "Higher-value public procurement notices across the UK.", coverage: "UK", access: ["Search", "Download", "API"], owner: "official" },
      { id: "pesa", name: "Public Expenditure Statistical Analyses", publisher: "HM Treasury", url: "https://www.gov.uk/government/collections/public-expenditure-statistical-analyses-pesa", description: "Public spending by function, department and nation or region.", coverage: "UK", access: ["Download"], owner: "official" },
      { id: "nao", name: "National Audit Office", publisher: "NAO", url: "https://www.nao.org.uk/", description: "Audits of government spending and value-for-money reports.", coverage: "UK", access: ["Search"], owner: "official" },
      { id: "charity-register", name: "Register of charities", publisher: "Charity Commission for England and Wales", url: "https://register-of-charities.charitycommission.gov.uk/", description: "Charity finances, trustees and annual returns.", coverage: "England and Wales", access: ["Search", "Download"], owner: "official" },
      { id: "grantnav", name: "GrantNav", publisher: "360Giving", url: "https://grantnav.threesixtygiving.org/", description: "Search grants published by funders, including government departments, in a common format.", coverage: "UK", access: ["Search", "Download"], owner: "independent" },
    ],
  },
  {
    id: "health-care",
    title: "Health and care",
    summary: "NHS performance, public health and care quality.",
    entries: [
      { id: "nhs-england-statistics", name: "NHS England statistics", publisher: "NHS England", url: "https://www.england.nhs.uk/statistics/", description: "Waiting times, A&E, ambulance, cancer and other NHS performance statistics.", coverage: "England", access: ["Download"], owner: "official" },
      { id: "nhs-digital-data", name: "NHS data and information", publisher: "NHS England", url: "https://digital.nhs.uk/data-and-information", description: "Official statistics on GP practices, prescribing, hospital activity and workforce.", coverage: "England", access: ["Search", "Download"], owner: "official" },
      { id: "fingertips", name: "Fingertips public health profiles", publisher: "Department of Health and Social Care", url: "https://fingertips.phe.org.uk/", description: "Public health indicators by local area.", coverage: "England", access: ["Search", "Download", "API"], owner: "official" },
      { id: "ukhsa-dashboard", name: "UKHSA data dashboard", publisher: "UK Health Security Agency", url: "https://ukhsa-dashboard.data.gov.uk/", description: "Infectious disease surveillance data.", coverage: "England", access: ["Dashboard", "Download", "API"], owner: "official" },
      { id: "public-health-scotland", name: "Public Health Scotland", publisher: "Public Health Scotland", url: "https://www.publichealthscotland.scot/", description: "Health and NHS statistics for Scotland.", coverage: "Scotland", access: ["Search", "Download"], owner: "official" },
      { id: "cqc", name: "Care Quality Commission", publisher: "CQC", url: "https://www.cqc.org.uk/", description: "Inspection ratings for hospitals, GPs, care homes and other providers.", coverage: "England", access: ["Search", "Download"], owner: "official" },
    ],
  },
  {
    id: "people-work",
    title: "Work, benefits and people",
    summary: "Employment, benefits, migration and equality.",
    entries: [
      { id: "stat-xplore", name: "Stat-Xplore", publisher: "Department for Work and Pensions", url: "https://stat-xplore.dwp.gov.uk/", description: "Build custom tables of benefit statistics, including Universal Credit.", coverage: "GB", access: ["Search", "Download", "API"], owner: "official" },
      { id: "dwp-statistics", name: "DWP statistics", publisher: "Department for Work and Pensions", url: "https://www.gov.uk/government/organisations/department-for-work-pensions/about/statistics", description: "Benefits, pensions, poverty and household income releases.", coverage: "UK", access: ["Download"], owner: "official" },
      { id: "immigration-statistics", name: "Immigration system statistics", publisher: "Home Office", url: "https://www.gov.uk/government/collections/immigration-statistics-quarterly-release", description: "Visas, asylum, returns and detention.", coverage: "UK", access: ["Download"], owner: "official" },
      { id: "ethnicity-facts", name: "Ethnicity facts and figures", publisher: "Cabinet Office", url: "https://www.ethnicity-facts-figures.service.gov.uk/", description: "Government data on outcomes by ethnicity across public services.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
    ],
  },
  {
    id: "education",
    title: "Education",
    summary: "Schools, colleges, universities and inspections.",
    entries: [
      { id: "explore-education-statistics", name: "Explore education statistics", publisher: "Department for Education", url: "https://explore-education-statistics.service.gov.uk/", description: "Official education statistics with table builder and downloads.", coverage: "England", access: ["Search", "Download", "API"], owner: "official" },
      { id: "gias", name: "Get information about schools", publisher: "Department for Education", url: "https://get-information-schools.service.gov.uk/", description: "Register of schools, academies and trusts.", coverage: "England", access: ["Search", "Download"], owner: "official" },
      { id: "compare-schools", name: "Compare school and college performance", publisher: "Department for Education", url: "https://www.compare-school-performance.service.gov.uk/", description: "Exam results and performance measures for individual schools and colleges.", coverage: "England", access: ["Search", "Download"], owner: "official" },
      { id: "ofsted-reports", name: "Ofsted reports", publisher: "Ofsted", url: "https://reports.ofsted.gov.uk/", description: "Inspection reports for schools, childcare and children's services.", coverage: "England", access: ["Search"], owner: "official" },
      { id: "hesa", name: "HESA data and analysis", publisher: "Jisc (HESA)", url: "https://www.hesa.ac.uk/data-and-analysis", description: "Higher education students, staff, finances and graduate outcomes.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
    ],
  },
  {
    id: "crime-justice",
    title: "Crime and justice",
    summary: "Recorded crime, courts, prisons and case law.",
    entries: [
      { id: "police-uk", name: "data.police.uk", publisher: "Home Office", url: "https://data.police.uk/", description: "Street-level crime, outcomes and stop and search data.", coverage: "England and Wales", access: ["Download", "API"], owner: "official" },
      { id: "ons-crime", name: "Crime and justice statistics", publisher: "ONS", url: "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice", description: "Crime Survey for England and Wales and police recorded crime.", coverage: "England and Wales", access: ["Download"], owner: "official" },
      { id: "moj-statistics", name: "Ministry of Justice statistics", publisher: "Ministry of Justice", url: "https://www.gov.uk/government/organisations/ministry-of-justice/about/statistics", description: "Courts, sentencing, prisons and probation.", coverage: "England and Wales", access: ["Download"], owner: "official" },
      { id: "find-case-law", name: "Find case law", publisher: "The National Archives", url: "https://caselaw.nationalarchives.gov.uk/", description: "Court judgments and tribunal decisions.", coverage: "UK", access: ["Search", "API"], owner: "official" },
    ],
  },
  {
    id: "housing-environment",
    title: "Housing, environment, energy and transport",
    summary: "Homes, weather, flooding, air quality, energy and travel.",
    entries: [
      { id: "mhclg-statistics", name: "Housing and local government statistics", publisher: "Ministry of Housing, Communities and Local Government", url: "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government/about/statistics", description: "Housebuilding, homelessness, council finance and English housing survey.", coverage: "England", access: ["Download"], owner: "official" },
      { id: "epc-register", name: "Find an energy certificate", publisher: "Ministry of Housing, Communities and Local Government", url: "https://www.gov.uk/find-energy-certificate", description: "Energy performance certificates for homes and buildings.", coverage: "England and Wales", access: ["Search"], owner: "official" },
      { id: "council-tax-bands", name: "Check your council tax band", publisher: "Valuation Office Agency", url: "https://www.gov.uk/council-tax-bands", description: "Council tax bands for properties in England and Wales.", coverage: "England and Wales", access: ["Search"], owner: "official" },
      { id: "met-office", name: "Met Office", publisher: "Met Office", url: "https://www.metoffice.gov.uk/", description: "Weather forecasts, warnings and historical climate data.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
      { id: "check-flooding", name: "Check for flooding", publisher: "Environment Agency", url: "https://check-for-flooding.service.gov.uk/", description: "Live flood warnings and river levels.", coverage: "England", access: ["Search", "Map"], owner: "official" },
      { id: "defra-data", name: "Defra Data Services Platform", publisher: "Department for Environment, Food and Rural Affairs", url: "https://environment.data.gov.uk/", description: "Environmental datasets including water quality and flood risk.", coverage: "England", access: ["Search", "Download", "API"], owner: "official" },
      { id: "uk-air", name: "UK-AIR", publisher: "Department for Environment, Food and Rural Affairs", url: "https://uk-air.defra.gov.uk/", description: "Air quality measurements, forecasts and pollution data.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
      { id: "desnz-statistics", name: "Energy statistics", publisher: "Department for Energy Security and Net Zero", url: "https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero/about/statistics", description: "Energy prices, consumption, emissions and fuel poverty.", coverage: "UK", access: ["Download"], owner: "official" },
      { id: "dft-statistics", name: "Transport statistics", publisher: "Department for Transport", url: "https://www.gov.uk/government/organisations/department-for-transport/about/statistics", description: "Road safety, traffic, rail, buses and vehicle licensing.", coverage: "GB", access: ["Download"], owner: "official" },
      { id: "bus-open-data", name: "Bus Open Data Service", publisher: "Department for Transport", url: "https://www.bus-data.dft.gov.uk/", description: "Bus timetables, fares and live locations.", coverage: "England", access: ["Download", "API"], owner: "official" },
      { id: "food-hygiene", name: "Food hygiene ratings", publisher: "Food Standards Agency", url: "https://ratings.food.gov.uk/", description: "Hygiene ratings for food businesses.", coverage: "England", access: ["Search", "Download", "API"], owner: "official" },
    ],
  },
  {
    id: "parliament-law",
    title: "Parliament, elections and law",
    summary: "What Parliament says and does, who funds politics, and the law itself.",
    entries: [
      { id: "hansard", name: "Hansard", publisher: "UK Parliament", url: "https://hansard.parliament.uk/", description: "Official record of debates in the Commons and Lords.", coverage: "UK", access: ["Search"], owner: "official" },
      { id: "commons-library", name: "House of Commons Library", publisher: "UK Parliament", url: "https://commonslibrary.parliament.uk/", description: "Impartial research briefings and constituency data.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
      { id: "written-questions", name: "Written questions and statements", publisher: "UK Parliament", url: "https://questions-statements.parliament.uk/", description: "Questions MPs and peers ask ministers, with the answers.", coverage: "UK", access: ["Search", "API"], owner: "official" },
      { id: "petitions", name: "Petitions", publisher: "UK Parliament", url: "https://petition.parliament.uk/", description: "Petitions to Parliament with signature counts by constituency.", coverage: "UK", access: ["Search", "API"], owner: "official" },
      { id: "electoral-commission-finance", name: "Political finance search", publisher: "Electoral Commission", url: "https://search.electoralcommission.org.uk/", description: "Donations, loans and spending reported by parties and campaigners.", coverage: "UK", access: ["Search", "Download"], owner: "official" },
      { id: "legislation-gov-uk", name: "legislation.gov.uk", publisher: "The National Archives", url: "https://www.legislation.gov.uk/", description: "Acts and statutory instruments, original and revised.", coverage: "UK", access: ["Search", "API"], owner: "official" },
      { id: "discovery", name: "Discovery catalogue", publisher: "The National Archives", url: "https://discovery.nationalarchives.gov.uk/", description: "Catalogue of government records held by The National Archives and other archives.", coverage: "UK", access: ["Search"], owner: "official" },
      { id: "theyworkforyou", name: "TheyWorkForYou", publisher: "mySociety", url: "https://www.theyworkforyou.com/", description: "Readable record of what your MP says and how they vote, built from parliamentary data.", coverage: "UK", access: ["Search", "API"], owner: "independent" },
    ],
  },
  {
    id: "ask",
    title: "Ask for data that is not published",
    summary: "Your legal rights to request information from public bodies.",
    entries: [
      { id: "foi", name: "Make a freedom of information request", publisher: "GOV.UK", url: "https://www.gov.uk/make-a-freedom-of-information-request", description: "How to request recorded information from a public authority.", coverage: "UK", access: ["Request"], owner: "official" },
      { id: "ico-official-information", name: "Official information guidance", publisher: "Information Commissioner's Office", url: "https://ico.org.uk/for-the-public/official-information/", description: "Your rights under FOI and environmental information rules, and how to complain.", coverage: "UK", access: ["Request"], owner: "official" },
      { id: "ico-sar", name: "Get copies of your personal information", publisher: "Information Commissioner's Office", url: "https://ico.org.uk/for-the-public/getting-copies-of-your-information-subject-access-request/", description: "Subject access requests for data an organisation holds about you.", coverage: "UK", access: ["Request"], owner: "official" },
      { id: "scottish-information-commissioner", name: "Scottish Information Commissioner", publisher: "Scottish Information Commissioner", url: "https://www.itspublicknowledge.info/", description: "FOI rights for Scottish public authorities, which have their own law.", coverage: "Scotland", access: ["Request"], owner: "official" },
      { id: "whatdotheyknow", name: "WhatDoTheyKnow", publisher: "mySociety", url: "https://www.whatdotheyknow.com/", description: "Make FOI requests in public and search answers others have received.", coverage: "UK", access: ["Search", "Request"], owner: "independent" },
    ],
  },
];

export const DIRECTORY_ENTRY_COUNT = GOV_DATA_DIRECTORY.reduce((sum, category) => sum + category.entries.length, 0);
export const DIRECTORY_OFFICIAL_COUNT = GOV_DATA_DIRECTORY.reduce((sum, category) => sum + category.entries.filter((entry) => entry.owner === "official").length, 0);
