// Generated from the final verified same-origin publication snapshot.
// Do not hand-edit or commit metric values to this file.
export const BUILD_METRICS_SNAPSHOT: unknown = {
  "meta": {
    "registryVersion": "2026-08-02.1",
    "sources": {
      "sentimentPulse": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T15:26:07.735Z",
        "source": "CPI annual rate D7G7 / MM23 + Official Bank Rate IUDBEDR / IADB + Unemployment rate MGSX / LMS",
        "provenance": {
          "registryVersion": "2026-08-02.1",
          "section": "sentimentPulse",
          "title": "Series-level economic indicators",
          "evidenceClass": "official-data",
          "geography": "United Kingdom",
          "retrieval": "scheduled-publication-check",
          "refreshCadence": "daily",
          "publicationCadence": "series-specific: monthly and event-driven",
          "operationalStatus": "active",
          "publicationRequirement": "required",
          "upstreams": [
            {
              "publisher": "Office for National Statistics",
              "label": "CPI annual rate D7G7 / MM23",
              "seriesId": "D7G7",
              "datasetId": "MM23",
              "url": "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
              "sourceClass": "official-primary",
              "caveat": "The Worker retrieves the official monthly CSV and the series page release metadata; the observation and publication clocks are retained separately."
            },
            {
              "publisher": "Bank of England",
              "label": "Official Bank Rate IUDBEDR / IADB",
              "seriesId": "IUDBEDR",
              "datasetId": "IADB",
              "url": "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp",
              "sourceClass": "official-primary",
              "caveat": "Bank Rate is event-dated and remains current until a later Monetary Policy Committee decision changes it."
            },
            {
              "publisher": "Office for National Statistics",
              "label": "Unemployment rate MGSX / LMS",
              "seriesId": "MGSX",
              "datasetId": "LMS",
              "url": "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
              "sourceClass": "official-primary",
              "caveat": "MGSX is a rolling three-month Labour Force Survey estimate. Its period is not aligned to the CPI month."
            }
          ]
        }
      },
      "taxRevenue": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T15:26:32.675Z",
        "source": "ONS Public sector finances bulletin and ANBV receipts series",
        "provenance": {
          "registryVersion": "2026-08-02.1",
          "section": "taxRevenue",
          "title": "Central government receipts",
          "evidenceClass": "official-data",
          "geography": "United Kingdom",
          "retrieval": "scheduled-publication-check",
          "refreshCadence": "daily",
          "publicationCadence": "monthly",
          "operationalStatus": "active",
          "publicationRequirement": "required",
          "upstreams": [
            {
              "publisher": "Office for National Statistics",
              "label": "Public sector finances, UK bulletin",
              "url": "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/latest",
              "sourceClass": "official-primary",
              "caveat": "The Worker extracts one monthly central-government-receipts measure from the latest bulletin and does not mix forecasts or tax-burden estimates."
            }
          ]
        }
      },
      "nationalDebt": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T15:26:35.446Z",
        "source": "Public sector net debt excluding public sector banks + Public sector net debt excluding public sector banks as a percentage of GDP",
        "provenance": {
          "registryVersion": "2026-08-02.1",
          "section": "nationalDebt",
          "title": "Public sector net debt excluding public sector banks",
          "evidenceClass": "official-data",
          "geography": "United Kingdom",
          "retrieval": "scheduled-publication-check",
          "refreshCadence": "daily",
          "publicationCadence": "monthly",
          "operationalStatus": "active",
          "publicationRequirement": "required",
          "upstreams": [
            {
              "publisher": "Office for National Statistics",
              "label": "Public sector net debt excluding public sector banks",
              "seriesId": "HF6W",
              "datasetId": "PUSF",
              "url": "https://www.ons.gov.uk/generator?format=csv&uri=/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf",
              "sourceClass": "official-primary"
            },
            {
              "publisher": "Office for National Statistics",
              "label": "Public sector net debt excluding public sector banks as a percentage of GDP",
              "seriesId": "HF6X",
              "datasetId": "PUSF",
              "url": "https://www.ons.gov.uk/generator?format=csv&uri=/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf",
              "sourceClass": "official-primary"
            }
          ]
        }
      },
      "crimeStatistics": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T03:18:38.675Z",
        "source": "Crime Survey for England and Wales (CSEW) + Police Recorded Crime (PRC) + Criminal Court Statistics",
        "provenance": {
          "registryVersion": "2026-08-02.1",
          "section": "crimeStatistics",
          "title": "UK Crime Statistics",
          "evidenceClass": "official-data",
          "geography": "England and Wales",
          "retrieval": "scheduled-publication-check",
          "refreshCadence": "daily",
          "publicationCadence": "periodic",
          "operationalStatus": "active",
          "publicationRequirement": "optional",
          "upstreams": [
            {
              "publisher": "Office for National Statistics",
              "label": "Crime Survey for England and Wales (CSEW)",
              "url": "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/latest",
              "sourceClass": "official-primary"
            },
            {
              "publisher": "Home Office",
              "label": "Police Recorded Crime (PRC)",
              "url": "https://www.gov.uk/government/statistics/police-recorded-crime-open-data-tables",
              "sourceClass": "official-primary"
            },
            {
              "publisher": "Ministry of Justice",
              "label": "Criminal Court Statistics",
              "url": "https://www.gov.uk/government/collections/criminal-court-statistics",
              "sourceClass": "official-primary"
            }
          ]
        }
      },
      "electionPolling": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T15:27:13.950Z",
        "source": "YouGov primary voting-intention article and result tables",
        "provenance": {
          "registryVersion": "2026-08-02.1",
          "section": "electionPolling",
          "title": "Primary voting-intention poll publications",
          "evidenceClass": "public-opinion",
          "geography": "Great Britain",
          "retrieval": "scheduled-publication-check",
          "refreshCadence": "daily",
          "publicationCadence": "as published",
          "operationalStatus": "active",
          "publicationRequirement": "required",
          "upstreams": [
            {
              "publisher": "YouGov",
              "label": "YouGov Westminster voting-intention primary tables",
              "url": "https://yougov.com/en-gb/articles",
              "sourceClass": "primary-pollster-publication",
              "caveat": "The private Worker discovers the latest named voting-intention article and retains the direct primary result-table URL. Each payload expires after 14 days."
            },
            {
              "publisher": "British Polling Council",
              "label": "British Polling Council disclosure rules",
              "url": "https://www.britishpollingcouncil.org/objects-and-rules/",
              "sourceClass": "methodology-standard"
            }
          ]
        }
      },
      "gdpTracker": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T15:25:45.916Z",
        "source": "GDP monthly estimate, UK bulletin",
        "provenance": {
          "registryVersion": "2026-08-02.1",
          "section": "gdpTracker",
          "title": "Monthly gross domestic product",
          "evidenceClass": "official-data",
          "geography": "United Kingdom",
          "retrieval": "scheduled-publication-check",
          "refreshCadence": "daily",
          "publicationCadence": "monthly",
          "operationalStatus": "active",
          "publicationRequirement": "required",
          "upstreams": [
            {
              "publisher": "Office for National Statistics",
              "label": "GDP monthly estimate, UK bulletin",
              "url": "https://www.ons.gov.uk/economy/grossdomesticproductgdp/bulletins/gdpmonthlyestimateuk/latest",
              "sourceClass": "official-primary",
              "caveat": "The Worker discovers and validates the latest bulletin edition from this rolling publication page."
            }
          ]
        }
      },
      "employmentStats": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T15:26:11.582Z",
        "source": "UK labour market bulletin",
        "provenance": {
          "registryVersion": "2026-08-02.1",
          "section": "employmentStats",
          "title": "UK labour market",
          "evidenceClass": "official-data",
          "geography": "United Kingdom",
          "retrieval": "scheduled-publication-check",
          "refreshCadence": "daily",
          "publicationCadence": "monthly",
          "operationalStatus": "active",
          "publicationRequirement": "required",
          "upstreams": [
            {
              "publisher": "Office for National Statistics",
              "label": "UK labour market bulletin",
              "url": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/latest",
              "sourceClass": "official-primary",
              "caveat": "The Worker keeps Labour Force Survey and vacancies periods explicit and discovers the latest bulletin edition."
            }
          ]
        }
      },
      "migrationStats": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T15:26:53.547Z",
        "source": "Long-term international migration, provisional bulletin + Long-term immigration, emigration and net migration dataset",
        "provenance": {
          "registryVersion": "2026-08-02.1",
          "section": "migrationStats",
          "title": "Long-term international migration",
          "evidenceClass": "official-data",
          "geography": "United Kingdom",
          "retrieval": "scheduled-publication-check",
          "refreshCadence": "daily",
          "publicationCadence": "periodic",
          "operationalStatus": "active",
          "publicationRequirement": "required",
          "upstreams": [
            {
              "publisher": "Office for National Statistics",
              "label": "Long-term international migration, provisional bulletin",
              "url": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/bulletins/longterminternationalmigrationprovisional/yearendingdecember2025",
              "sourceClass": "official-primary",
              "caveat": "The Worker discovers the current edition from the rolling dataset page before retrieving the bulletin; this URL records the edition verified on 14 July 2026."
            },
            {
              "publisher": "Office for National Statistics",
              "label": "Long-term immigration, emigration and net migration dataset",
              "url": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional",
              "sourceClass": "official-primary"
            }
          ]
        }
      },
      "realWages": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T15:26:56.880Z",
        "source": "Average weekly earnings in Great Britain bulletin",
        "provenance": {
          "registryVersion": "2026-08-02.1",
          "section": "realWages",
          "title": "Real-terms growth in average weekly earnings",
          "evidenceClass": "official-data",
          "geography": "Great Britain",
          "retrieval": "scheduled-publication-check",
          "refreshCadence": "daily",
          "publicationCadence": "monthly",
          "operationalStatus": "active",
          "publicationRequirement": "required",
          "upstreams": [
            {
              "publisher": "Office for National Statistics",
              "label": "Average weekly earnings in Great Britain bulletin",
              "url": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/latest",
              "sourceClass": "official-primary",
              "caveat": "The Worker discovers the current edition from the rolling bulletin alias and extracts ONS's own published real-terms (CPIH-adjusted) growth figure rather than deriving it from nominal pay and inflation separately."
            }
          ]
        }
      },
      "governmentContracts": {
        "status": "ok",
        "cacheState": "fresh",
        "fetchedAt": "2026-10-01T15:34:53.133Z",
        "source": "Cabinet Office Find a Tender OCDS award releases",
        "sourceUrl": "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages",
        "provenance": "current-collection",
        "publicationRequirement": "optional",
        "observationPeriod": "24 Sept 2026 to 1 Oct 2026",
        "evidenceClass": "official-procurement-data"
      }
    },
    "generatedAt": "2026-10-01T15:25:40.068Z",
    "fetchedAt": "2026-10-01T15:25:40.068Z",
    "delivery": "published-snapshot",
    "publicationDiagnostics": {
      "housePriceIndex": {
        "section": "housePriceIndex",
        "code": "snapshot_delivery_failure",
        "summary": "The published snapshot does not contain a usable section manifest.",
        "status": null,
        "cacheState": null,
        "fetchedAt": null
      },
      "nhsStats": {
        "section": "nhsStats",
        "code": "snapshot_delivery_failure",
        "summary": "The published snapshot does not contain a usable section manifest.",
        "status": null,
        "cacheState": null,
        "fetchedAt": null
      },
      "bettingOdds": {
        "section": "bettingOdds",
        "code": "snapshot_delivery_failure",
        "summary": "The published snapshot does not contain a usable section manifest.",
        "status": null,
        "cacheState": null,
        "fetchedAt": null
      }
    },
    "publicationState": "degraded",
    "missingRequiredSections": [
      "housePriceIndex"
    ],
    "verifiedSections": [
      "governmentContracts"
    ]
  },
  "sentimentPulse": {
    "available": true,
    "order": [
      "inflation",
      "bankRate",
      "unemployment"
    ],
    "series": {
      "inflation": {
        "id": "inflation",
        "label": "CPI inflation",
        "shortLabel": "Inflation",
        "value": 3.1,
        "unit": "%",
        "color": "#C92F00",
        "period": "August 2026",
        "observedAt": "2026-08-31T00:00:00.000Z",
        "publishedAt": "2026-09-16T00:00:00.000Z",
        "retrievedAt": "2026-10-01T15:26:07.735Z",
        "publisher": "Office for National Statistics",
        "sourceUrl": "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
        "seriesId": "D7G7",
        "datasetId": "MM23",
        "frequency": "Monthly",
        "revisionStatus": "The latest CPI estimate can be revised under the ONS consumer price inflation revision policy.",
        "evidenceClass": "official-data",
        "status": "current",
        "nextRelease": "2026-10-21",
        "annualDelta": -0.7,
        "annualDeltaUnit": "percentage points",
        "history": [
          {
            "period": "September 2016",
            "observedAt": "2016-09-30T00:00:00.000Z",
            "value": 1
          },
          {
            "period": "October 2016",
            "observedAt": "2016-10-31T00:00:00.000Z",
            "value": 0.9
          },
          {
            "period": "November 2016",
            "observedAt": "2016-11-30T00:00:00.000Z",
            "value": 1.2
          },
          {
            "period": "December 2016",
            "observedAt": "2016-12-31T00:00:00.000Z",
            "value": 1.6
          },
          {
            "period": "January 2017",
            "observedAt": "2017-01-31T00:00:00.000Z",
            "value": 1.8
          },
          {
            "period": "February 2017",
            "observedAt": "2017-02-28T00:00:00.000Z",
            "value": 2.3
          },
          {
            "period": "March 2017",
            "observedAt": "2017-03-31T00:00:00.000Z",
            "value": 2.3
          },
          {
            "period": "April 2017",
            "observedAt": "2017-04-30T00:00:00.000Z",
            "value": 2.7
          },
          {
            "period": "May 2017",
            "observedAt": "2017-05-31T00:00:00.000Z",
            "value": 2.9
          },
          {
            "period": "June 2017",
            "observedAt": "2017-06-30T00:00:00.000Z",
            "value": 2.6
          },
          {
            "period": "July 2017",
            "observedAt": "2017-07-31T00:00:00.000Z",
            "value": 2.6
          },
          {
            "period": "August 2017",
            "observedAt": "2017-08-31T00:00:00.000Z",
            "value": 2.9
          },
          {
            "period": "September 2017",
            "observedAt": "2017-09-30T00:00:00.000Z",
            "value": 3
          },
          {
            "period": "October 2017",
            "observedAt": "2017-10-31T00:00:00.000Z",
            "value": 3
          },
          {
            "period": "November 2017",
            "observedAt": "2017-11-30T00:00:00.000Z",
            "value": 3.1
          },
          {
            "period": "December 2017",
            "observedAt": "2017-12-31T00:00:00.000Z",
            "value": 3
          },
          {
            "period": "January 2018",
            "observedAt": "2018-01-31T00:00:00.000Z",
            "value": 3
          },
          {
            "period": "February 2018",
            "observedAt": "2018-02-28T00:00:00.000Z",
            "value": 2.7
          },
          {
            "period": "March 2018",
            "observedAt": "2018-03-31T00:00:00.000Z",
            "value": 2.5
          },
          {
            "period": "April 2018",
            "observedAt": "2018-04-30T00:00:00.000Z",
            "value": 2.4
          },
          {
            "period": "May 2018",
            "observedAt": "2018-05-31T00:00:00.000Z",
            "value": 2.4
          },
          {
            "period": "June 2018",
            "observedAt": "2018-06-30T00:00:00.000Z",
            "value": 2.4
          },
          {
            "period": "July 2018",
            "observedAt": "2018-07-31T00:00:00.000Z",
            "value": 2.5
          },
          {
            "period": "August 2018",
            "observedAt": "2018-08-31T00:00:00.000Z",
            "value": 2.7
          },
          {
            "period": "September 2018",
            "observedAt": "2018-09-30T00:00:00.000Z",
            "value": 2.4
          },
          {
            "period": "October 2018",
            "observedAt": "2018-10-31T00:00:00.000Z",
            "value": 2.4
          },
          {
            "period": "November 2018",
            "observedAt": "2018-11-30T00:00:00.000Z",
            "value": 2.3
          },
          {
            "period": "December 2018",
            "observedAt": "2018-12-31T00:00:00.000Z",
            "value": 2.1
          },
          {
            "period": "January 2019",
            "observedAt": "2019-01-31T00:00:00.000Z",
            "value": 1.8
          },
          {
            "period": "February 2019",
            "observedAt": "2019-02-28T00:00:00.000Z",
            "value": 1.9
          },
          {
            "period": "March 2019",
            "observedAt": "2019-03-31T00:00:00.000Z",
            "value": 1.9
          },
          {
            "period": "April 2019",
            "observedAt": "2019-04-30T00:00:00.000Z",
            "value": 2.1
          },
          {
            "period": "May 2019",
            "observedAt": "2019-05-31T00:00:00.000Z",
            "value": 2
          },
          {
            "period": "June 2019",
            "observedAt": "2019-06-30T00:00:00.000Z",
            "value": 2
          },
          {
            "period": "July 2019",
            "observedAt": "2019-07-31T00:00:00.000Z",
            "value": 2.1
          },
          {
            "period": "August 2019",
            "observedAt": "2019-08-31T00:00:00.000Z",
            "value": 1.7
          },
          {
            "period": "September 2019",
            "observedAt": "2019-09-30T00:00:00.000Z",
            "value": 1.7
          },
          {
            "period": "October 2019",
            "observedAt": "2019-10-31T00:00:00.000Z",
            "value": 1.5
          },
          {
            "period": "November 2019",
            "observedAt": "2019-11-30T00:00:00.000Z",
            "value": 1.5
          },
          {
            "period": "December 2019",
            "observedAt": "2019-12-31T00:00:00.000Z",
            "value": 1.3
          },
          {
            "period": "January 2020",
            "observedAt": "2020-01-31T00:00:00.000Z",
            "value": 1.8
          },
          {
            "period": "February 2020",
            "observedAt": "2020-02-29T00:00:00.000Z",
            "value": 1.7
          },
          {
            "period": "March 2020",
            "observedAt": "2020-03-31T00:00:00.000Z",
            "value": 1.5
          },
          {
            "period": "April 2020",
            "observedAt": "2020-04-30T00:00:00.000Z",
            "value": 0.8
          },
          {
            "period": "May 2020",
            "observedAt": "2020-05-31T00:00:00.000Z",
            "value": 0.5
          },
          {
            "period": "June 2020",
            "observedAt": "2020-06-30T00:00:00.000Z",
            "value": 0.6
          },
          {
            "period": "July 2020",
            "observedAt": "2020-07-31T00:00:00.000Z",
            "value": 1
          },
          {
            "period": "August 2020",
            "observedAt": "2020-08-31T00:00:00.000Z",
            "value": 0.2
          },
          {
            "period": "September 2020",
            "observedAt": "2020-09-30T00:00:00.000Z",
            "value": 0.5
          },
          {
            "period": "October 2020",
            "observedAt": "2020-10-31T00:00:00.000Z",
            "value": 0.7
          },
          {
            "period": "November 2020",
            "observedAt": "2020-11-30T00:00:00.000Z",
            "value": 0.3
          },
          {
            "period": "December 2020",
            "observedAt": "2020-12-31T00:00:00.000Z",
            "value": 0.6
          },
          {
            "period": "January 2021",
            "observedAt": "2021-01-31T00:00:00.000Z",
            "value": 0.7
          },
          {
            "period": "February 2021",
            "observedAt": "2021-02-28T00:00:00.000Z",
            "value": 0.4
          },
          {
            "period": "March 2021",
            "observedAt": "2021-03-31T00:00:00.000Z",
            "value": 0.7
          },
          {
            "period": "April 2021",
            "observedAt": "2021-04-30T00:00:00.000Z",
            "value": 1.5
          },
          {
            "period": "May 2021",
            "observedAt": "2021-05-31T00:00:00.000Z",
            "value": 2.1
          },
          {
            "period": "June 2021",
            "observedAt": "2021-06-30T00:00:00.000Z",
            "value": 2.5
          },
          {
            "period": "July 2021",
            "observedAt": "2021-07-31T00:00:00.000Z",
            "value": 2
          },
          {
            "period": "August 2021",
            "observedAt": "2021-08-31T00:00:00.000Z",
            "value": 3.2
          },
          {
            "period": "September 2021",
            "observedAt": "2021-09-30T00:00:00.000Z",
            "value": 3.1
          },
          {
            "period": "October 2021",
            "observedAt": "2021-10-31T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "November 2021",
            "observedAt": "2021-11-30T00:00:00.000Z",
            "value": 5.1
          },
          {
            "period": "December 2021",
            "observedAt": "2021-12-31T00:00:00.000Z",
            "value": 5.4
          },
          {
            "period": "January 2022",
            "observedAt": "2022-01-31T00:00:00.000Z",
            "value": 5.5
          },
          {
            "period": "February 2022",
            "observedAt": "2022-02-28T00:00:00.000Z",
            "value": 6.2
          },
          {
            "period": "March 2022",
            "observedAt": "2022-03-31T00:00:00.000Z",
            "value": 7
          },
          {
            "period": "April 2022",
            "observedAt": "2022-04-30T00:00:00.000Z",
            "value": 9
          },
          {
            "period": "May 2022",
            "observedAt": "2022-05-31T00:00:00.000Z",
            "value": 9.1
          },
          {
            "period": "June 2022",
            "observedAt": "2022-06-30T00:00:00.000Z",
            "value": 9.4
          },
          {
            "period": "July 2022",
            "observedAt": "2022-07-31T00:00:00.000Z",
            "value": 10.1
          },
          {
            "period": "August 2022",
            "observedAt": "2022-08-31T00:00:00.000Z",
            "value": 9.9
          },
          {
            "period": "September 2022",
            "observedAt": "2022-09-30T00:00:00.000Z",
            "value": 10.1
          },
          {
            "period": "October 2022",
            "observedAt": "2022-10-31T00:00:00.000Z",
            "value": 11.1
          },
          {
            "period": "November 2022",
            "observedAt": "2022-11-30T00:00:00.000Z",
            "value": 10.7
          },
          {
            "period": "December 2022",
            "observedAt": "2022-12-31T00:00:00.000Z",
            "value": 10.5
          },
          {
            "period": "January 2023",
            "observedAt": "2023-01-31T00:00:00.000Z",
            "value": 10.1
          },
          {
            "period": "February 2023",
            "observedAt": "2023-02-28T00:00:00.000Z",
            "value": 10.4
          },
          {
            "period": "March 2023",
            "observedAt": "2023-03-31T00:00:00.000Z",
            "value": 10.1
          },
          {
            "period": "April 2023",
            "observedAt": "2023-04-30T00:00:00.000Z",
            "value": 8.7
          },
          {
            "period": "May 2023",
            "observedAt": "2023-05-31T00:00:00.000Z",
            "value": 8.7
          },
          {
            "period": "June 2023",
            "observedAt": "2023-06-30T00:00:00.000Z",
            "value": 7.9
          },
          {
            "period": "July 2023",
            "observedAt": "2023-07-31T00:00:00.000Z",
            "value": 6.8
          },
          {
            "period": "August 2023",
            "observedAt": "2023-08-31T00:00:00.000Z",
            "value": 6.7
          },
          {
            "period": "September 2023",
            "observedAt": "2023-09-30T00:00:00.000Z",
            "value": 6.7
          },
          {
            "period": "October 2023",
            "observedAt": "2023-10-31T00:00:00.000Z",
            "value": 4.6
          },
          {
            "period": "November 2023",
            "observedAt": "2023-11-30T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "December 2023",
            "observedAt": "2023-12-31T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "January 2024",
            "observedAt": "2024-01-31T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "February 2024",
            "observedAt": "2024-02-29T00:00:00.000Z",
            "value": 3.4
          },
          {
            "period": "March 2024",
            "observedAt": "2024-03-31T00:00:00.000Z",
            "value": 3.2
          },
          {
            "period": "April 2024",
            "observedAt": "2024-04-30T00:00:00.000Z",
            "value": 2.3
          },
          {
            "period": "May 2024",
            "observedAt": "2024-05-31T00:00:00.000Z",
            "value": 2
          },
          {
            "period": "June 2024",
            "observedAt": "2024-06-30T00:00:00.000Z",
            "value": 2
          },
          {
            "period": "July 2024",
            "observedAt": "2024-07-31T00:00:00.000Z",
            "value": 2.2
          },
          {
            "period": "August 2024",
            "observedAt": "2024-08-31T00:00:00.000Z",
            "value": 2.2
          },
          {
            "period": "September 2024",
            "observedAt": "2024-09-30T00:00:00.000Z",
            "value": 1.7
          },
          {
            "period": "October 2024",
            "observedAt": "2024-10-31T00:00:00.000Z",
            "value": 2.3
          },
          {
            "period": "November 2024",
            "observedAt": "2024-11-30T00:00:00.000Z",
            "value": 2.6
          },
          {
            "period": "December 2024",
            "observedAt": "2024-12-31T00:00:00.000Z",
            "value": 2.5
          },
          {
            "period": "January 2025",
            "observedAt": "2025-01-31T00:00:00.000Z",
            "value": 3
          },
          {
            "period": "February 2025",
            "observedAt": "2025-02-28T00:00:00.000Z",
            "value": 2.8
          },
          {
            "period": "March 2025",
            "observedAt": "2025-03-31T00:00:00.000Z",
            "value": 2.6
          },
          {
            "period": "April 2025",
            "observedAt": "2025-04-30T00:00:00.000Z",
            "value": 3.5
          },
          {
            "period": "May 2025",
            "observedAt": "2025-05-31T00:00:00.000Z",
            "value": 3.4
          },
          {
            "period": "June 2025",
            "observedAt": "2025-06-30T00:00:00.000Z",
            "value": 3.6
          },
          {
            "period": "July 2025",
            "observedAt": "2025-07-31T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "August 2025",
            "observedAt": "2025-08-31T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "September 2025",
            "observedAt": "2025-09-30T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "October 2025",
            "observedAt": "2025-10-31T00:00:00.000Z",
            "value": 3.6
          },
          {
            "period": "November 2025",
            "observedAt": "2025-11-30T00:00:00.000Z",
            "value": 3.2
          },
          {
            "period": "December 2025",
            "observedAt": "2025-12-31T00:00:00.000Z",
            "value": 3.4
          },
          {
            "period": "January 2026",
            "observedAt": "2026-01-31T00:00:00.000Z",
            "value": 3
          },
          {
            "period": "February 2026",
            "observedAt": "2026-02-28T00:00:00.000Z",
            "value": 3
          },
          {
            "period": "March 2026",
            "observedAt": "2026-03-31T00:00:00.000Z",
            "value": 3.3
          },
          {
            "period": "April 2026",
            "observedAt": "2026-04-30T00:00:00.000Z",
            "value": 2.8
          },
          {
            "period": "May 2026",
            "observedAt": "2026-05-31T00:00:00.000Z",
            "value": 2.8
          },
          {
            "period": "June 2026",
            "observedAt": "2026-06-30T00:00:00.000Z",
            "value": 2.6
          },
          {
            "period": "July 2026",
            "observedAt": "2026-07-31T00:00:00.000Z",
            "value": 2.9
          },
          {
            "period": "August 2026",
            "observedAt": "2026-08-31T00:00:00.000Z",
            "value": 3.1
          }
        ]
      },
      "bankRate": {
        "id": "bankRate",
        "label": "Official Bank Rate",
        "shortLabel": "Bank Rate",
        "value": 3.75,
        "unit": "%",
        "color": "#111111",
        "period": "18 December 2025",
        "observedAt": "2025-12-18T00:00:00.000Z",
        "publishedAt": "2025-12-18T00:00:00.000Z",
        "retrievedAt": "2026-10-01T15:26:07.735Z",
        "publisher": "Bank of England",
        "sourceUrl": "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp",
        "seriesId": "IUDBEDR",
        "datasetId": "IADB",
        "frequency": "Changed by Monetary Policy Committee decision",
        "revisionStatus": "The official rate history is event-dated rather than statistically revised.",
        "evidenceClass": "official-data",
        "status": "current",
        "nextRelease": null,
        "annualDelta": -1,
        "annualDeltaUnit": "percentage points",
        "history": [
          {
            "period": "4 August 2016",
            "observedAt": "2016-08-04T00:00:00.000Z",
            "value": 0.25
          },
          {
            "period": "2 November 2017",
            "observedAt": "2017-11-02T00:00:00.000Z",
            "value": 0.5
          },
          {
            "period": "2 August 2018",
            "observedAt": "2018-08-02T00:00:00.000Z",
            "value": 0.75
          },
          {
            "period": "11 March 2020",
            "observedAt": "2020-03-11T00:00:00.000Z",
            "value": 0.25
          },
          {
            "period": "19 March 2020",
            "observedAt": "2020-03-19T00:00:00.000Z",
            "value": 0.1
          },
          {
            "period": "16 December 2021",
            "observedAt": "2021-12-16T00:00:00.000Z",
            "value": 0.25
          },
          {
            "period": "3 February 2022",
            "observedAt": "2022-02-03T00:00:00.000Z",
            "value": 0.5
          },
          {
            "period": "17 March 2022",
            "observedAt": "2022-03-17T00:00:00.000Z",
            "value": 0.75
          },
          {
            "period": "5 May 2022",
            "observedAt": "2022-05-05T00:00:00.000Z",
            "value": 1
          },
          {
            "period": "16 June 2022",
            "observedAt": "2022-06-16T00:00:00.000Z",
            "value": 1.25
          },
          {
            "period": "4 August 2022",
            "observedAt": "2022-08-04T00:00:00.000Z",
            "value": 1.75
          },
          {
            "period": "22 September 2022",
            "observedAt": "2022-09-22T00:00:00.000Z",
            "value": 2.25
          },
          {
            "period": "3 November 2022",
            "observedAt": "2022-11-03T00:00:00.000Z",
            "value": 3
          },
          {
            "period": "15 December 2022",
            "observedAt": "2022-12-15T00:00:00.000Z",
            "value": 3.5
          },
          {
            "period": "2 February 2023",
            "observedAt": "2023-02-02T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "23 March 2023",
            "observedAt": "2023-03-23T00:00:00.000Z",
            "value": 4.25
          },
          {
            "period": "11 May 2023",
            "observedAt": "2023-05-11T00:00:00.000Z",
            "value": 4.5
          },
          {
            "period": "22 June 2023",
            "observedAt": "2023-06-22T00:00:00.000Z",
            "value": 5
          },
          {
            "period": "3 August 2023",
            "observedAt": "2023-08-03T00:00:00.000Z",
            "value": 5.25
          },
          {
            "period": "1 August 2024",
            "observedAt": "2024-08-01T00:00:00.000Z",
            "value": 5
          },
          {
            "period": "7 November 2024",
            "observedAt": "2024-11-07T00:00:00.000Z",
            "value": 4.75
          },
          {
            "period": "6 February 2025",
            "observedAt": "2025-02-06T00:00:00.000Z",
            "value": 4.5
          },
          {
            "period": "8 May 2025",
            "observedAt": "2025-05-08T00:00:00.000Z",
            "value": 4.25
          },
          {
            "period": "7 August 2025",
            "observedAt": "2025-08-07T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "18 December 2025",
            "observedAt": "2025-12-18T00:00:00.000Z",
            "value": 3.75
          }
        ]
      },
      "unemployment": {
        "id": "unemployment",
        "label": "Unemployment rate",
        "shortLabel": "Unemployment",
        "value": 4.9,
        "unit": "%",
        "color": "#555555",
        "period": "May 2026 to July 2026",
        "observedAt": "2026-07-31T00:00:00.000Z",
        "publishedAt": "2026-09-15T00:00:00.000Z",
        "retrievedAt": "2026-10-01T15:26:07.735Z",
        "publisher": "Office for National Statistics",
        "sourceUrl": "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
        "seriesId": "MGSX",
        "datasetId": "LMS",
        "frequency": "Monthly publication of a rolling three-month estimate",
        "revisionStatus": "Labour Force Survey estimates are subject to sampling uncertainty and later revision.",
        "evidenceClass": "official-data",
        "status": "current",
        "nextRelease": "2026-10-20",
        "annualDelta": 0.2,
        "annualDeltaUnit": "percentage points",
        "history": [
          {
            "period": "June 2016 to August 2016",
            "observedAt": "2016-08-31T00:00:00.000Z",
            "value": 5
          },
          {
            "period": "July 2016 to September 2016",
            "observedAt": "2016-09-30T00:00:00.000Z",
            "value": 4.8
          },
          {
            "period": "August 2016 to October 2016",
            "observedAt": "2016-10-31T00:00:00.000Z",
            "value": 4.8
          },
          {
            "period": "September 2016 to November 2016",
            "observedAt": "2016-11-30T00:00:00.000Z",
            "value": 4.8
          },
          {
            "period": "October 2016 to December 2016",
            "observedAt": "2016-12-31T00:00:00.000Z",
            "value": 4.7
          },
          {
            "period": "November 2016 to January 2017",
            "observedAt": "2017-01-31T00:00:00.000Z",
            "value": 4.7
          },
          {
            "period": "December 2016 to February 2017",
            "observedAt": "2017-02-28T00:00:00.000Z",
            "value": 4.6
          },
          {
            "period": "January 2017 to March 2017",
            "observedAt": "2017-03-31T00:00:00.000Z",
            "value": 4.6
          },
          {
            "period": "February 2017 to April 2017",
            "observedAt": "2017-04-30T00:00:00.000Z",
            "value": 4.5
          },
          {
            "period": "March 2017 to May 2017",
            "observedAt": "2017-05-31T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "April 2017 to June 2017",
            "observedAt": "2017-06-30T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "May 2017 to July 2017",
            "observedAt": "2017-07-31T00:00:00.000Z",
            "value": 4.3
          },
          {
            "period": "June 2017 to August 2017",
            "observedAt": "2017-08-31T00:00:00.000Z",
            "value": 4.3
          },
          {
            "period": "July 2017 to September 2017",
            "observedAt": "2017-09-30T00:00:00.000Z",
            "value": 4.3
          },
          {
            "period": "August 2017 to October 2017",
            "observedAt": "2017-10-31T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "September 2017 to November 2017",
            "observedAt": "2017-11-30T00:00:00.000Z",
            "value": 4.3
          },
          {
            "period": "October 2017 to December 2017",
            "observedAt": "2017-12-31T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "November 2017 to January 2018",
            "observedAt": "2018-01-31T00:00:00.000Z",
            "value": 4.3
          },
          {
            "period": "December 2017 to February 2018",
            "observedAt": "2018-02-28T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "January 2018 to March 2018",
            "observedAt": "2018-03-31T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "February 2018 to April 2018",
            "observedAt": "2018-04-30T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "March 2018 to May 2018",
            "observedAt": "2018-05-31T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "April 2018 to June 2018",
            "observedAt": "2018-06-30T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "May 2018 to July 2018",
            "observedAt": "2018-07-31T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "June 2018 to August 2018",
            "observedAt": "2018-08-31T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "July 2018 to September 2018",
            "observedAt": "2018-09-30T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "August 2018 to October 2018",
            "observedAt": "2018-10-31T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "September 2018 to November 2018",
            "observedAt": "2018-11-30T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "October 2018 to December 2018",
            "observedAt": "2018-12-31T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "November 2018 to January 2019",
            "observedAt": "2019-01-31T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "December 2018 to February 2019",
            "observedAt": "2019-02-28T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "January 2019 to March 2019",
            "observedAt": "2019-03-31T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "February 2019 to April 2019",
            "observedAt": "2019-04-30T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "March 2019 to May 2019",
            "observedAt": "2019-05-31T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "April 2019 to June 2019",
            "observedAt": "2019-06-30T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "May 2019 to July 2019",
            "observedAt": "2019-07-31T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "June 2019 to August 2019",
            "observedAt": "2019-08-31T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "July 2019 to September 2019",
            "observedAt": "2019-09-30T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "August 2019 to October 2019",
            "observedAt": "2019-10-31T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "September 2019 to November 2019",
            "observedAt": "2019-11-30T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "October 2019 to December 2019",
            "observedAt": "2019-12-31T00:00:00.000Z",
            "value": 3.7
          },
          {
            "period": "November 2019 to January 2020",
            "observedAt": "2020-01-31T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "December 2019 to February 2020",
            "observedAt": "2020-02-29T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "January 2020 to March 2020",
            "observedAt": "2020-03-31T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "February 2020 to April 2020",
            "observedAt": "2020-04-30T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "March 2020 to May 2020",
            "observedAt": "2020-05-31T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "April 2020 to June 2020",
            "observedAt": "2020-06-30T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "May 2020 to July 2020",
            "observedAt": "2020-07-31T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "June 2020 to August 2020",
            "observedAt": "2020-08-31T00:00:00.000Z",
            "value": 4.6
          },
          {
            "period": "July 2020 to September 2020",
            "observedAt": "2020-09-30T00:00:00.000Z",
            "value": 5
          },
          {
            "period": "August 2020 to October 2020",
            "observedAt": "2020-10-31T00:00:00.000Z",
            "value": 5.2
          },
          {
            "period": "September 2020 to November 2020",
            "observedAt": "2020-11-30T00:00:00.000Z",
            "value": 5.2
          },
          {
            "period": "October 2020 to December 2020",
            "observedAt": "2020-12-31T00:00:00.000Z",
            "value": 5.3
          },
          {
            "period": "November 2020 to January 2021",
            "observedAt": "2021-01-31T00:00:00.000Z",
            "value": 5.2
          },
          {
            "period": "December 2020 to February 2021",
            "observedAt": "2021-02-28T00:00:00.000Z",
            "value": 5
          },
          {
            "period": "January 2021 to March 2021",
            "observedAt": "2021-03-31T00:00:00.000Z",
            "value": 4.9
          },
          {
            "period": "February 2021 to April 2021",
            "observedAt": "2021-04-30T00:00:00.000Z",
            "value": 4.8
          },
          {
            "period": "March 2021 to May 2021",
            "observedAt": "2021-05-31T00:00:00.000Z",
            "value": 4.8
          },
          {
            "period": "April 2021 to June 2021",
            "observedAt": "2021-06-30T00:00:00.000Z",
            "value": 4.7
          },
          {
            "period": "May 2021 to July 2021",
            "observedAt": "2021-07-31T00:00:00.000Z",
            "value": 4.6
          },
          {
            "period": "June 2021 to August 2021",
            "observedAt": "2021-08-31T00:00:00.000Z",
            "value": 4.5
          },
          {
            "period": "July 2021 to September 2021",
            "observedAt": "2021-09-30T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "August 2021 to October 2021",
            "observedAt": "2021-10-31T00:00:00.000Z",
            "value": 4.3
          },
          {
            "period": "September 2021 to November 2021",
            "observedAt": "2021-11-30T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "October 2021 to December 2021",
            "observedAt": "2021-12-31T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "November 2021 to January 2022",
            "observedAt": "2022-01-31T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "December 2021 to February 2022",
            "observedAt": "2022-02-28T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "January 2022 to March 2022",
            "observedAt": "2022-03-31T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "February 2022 to April 2022",
            "observedAt": "2022-04-30T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "March 2022 to May 2022",
            "observedAt": "2022-05-31T00:00:00.000Z",
            "value": 3.7
          },
          {
            "period": "April 2022 to June 2022",
            "observedAt": "2022-06-30T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "May 2022 to July 2022",
            "observedAt": "2022-07-31T00:00:00.000Z",
            "value": 3.6
          },
          {
            "period": "June 2022 to August 2022",
            "observedAt": "2022-08-31T00:00:00.000Z",
            "value": 3.6
          },
          {
            "period": "July 2022 to September 2022",
            "observedAt": "2022-09-30T00:00:00.000Z",
            "value": 3.7
          },
          {
            "period": "August 2022 to October 2022",
            "observedAt": "2022-10-31T00:00:00.000Z",
            "value": 3.8
          },
          {
            "period": "September 2022 to November 2022",
            "observedAt": "2022-11-30T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "October 2022 to December 2022",
            "observedAt": "2022-12-31T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "November 2022 to January 2023",
            "observedAt": "2023-01-31T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "December 2022 to February 2023",
            "observedAt": "2023-02-28T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "January 2023 to March 2023",
            "observedAt": "2023-03-31T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "February 2023 to April 2023",
            "observedAt": "2023-04-30T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "March 2023 to May 2023",
            "observedAt": "2023-05-31T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "April 2023 to June 2023",
            "observedAt": "2023-06-30T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "May 2023 to July 2023",
            "observedAt": "2023-07-31T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "June 2023 to August 2023",
            "observedAt": "2023-08-31T00:00:00.000Z",
            "value": 4.3
          },
          {
            "period": "July 2023 to September 2023",
            "observedAt": "2023-09-30T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "August 2023 to October 2023",
            "observedAt": "2023-10-31T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "September 2023 to November 2023",
            "observedAt": "2023-11-30T00:00:00.000Z",
            "value": 4
          },
          {
            "period": "October 2023 to December 2023",
            "observedAt": "2023-12-31T00:00:00.000Z",
            "value": 3.9
          },
          {
            "period": "November 2023 to January 2024",
            "observedAt": "2024-01-31T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "December 2023 to February 2024",
            "observedAt": "2024-02-29T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "January 2024 to March 2024",
            "observedAt": "2024-03-31T00:00:00.000Z",
            "value": 4.3
          },
          {
            "period": "February 2024 to April 2024",
            "observedAt": "2024-04-30T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "March 2024 to May 2024",
            "observedAt": "2024-05-31T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "April 2024 to June 2024",
            "observedAt": "2024-06-30T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "May 2024 to July 2024",
            "observedAt": "2024-07-31T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "June 2024 to August 2024",
            "observedAt": "2024-08-31T00:00:00.000Z",
            "value": 4.1
          },
          {
            "period": "July 2024 to September 2024",
            "observedAt": "2024-09-30T00:00:00.000Z",
            "value": 4.3
          },
          {
            "period": "August 2024 to October 2024",
            "observedAt": "2024-10-31T00:00:00.000Z",
            "value": 4.2
          },
          {
            "period": "September 2024 to November 2024",
            "observedAt": "2024-11-30T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "October 2024 to December 2024",
            "observedAt": "2024-12-31T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "November 2024 to January 2025",
            "observedAt": "2025-01-31T00:00:00.000Z",
            "value": 4.4
          },
          {
            "period": "December 2024 to February 2025",
            "observedAt": "2025-02-28T00:00:00.000Z",
            "value": 4.5
          },
          {
            "period": "January 2025 to March 2025",
            "observedAt": "2025-03-31T00:00:00.000Z",
            "value": 4.6
          },
          {
            "period": "February 2025 to April 2025",
            "observedAt": "2025-04-30T00:00:00.000Z",
            "value": 4.6
          },
          {
            "period": "March 2025 to May 2025",
            "observedAt": "2025-05-31T00:00:00.000Z",
            "value": 4.7
          },
          {
            "period": "April 2025 to June 2025",
            "observedAt": "2025-06-30T00:00:00.000Z",
            "value": 4.7
          },
          {
            "period": "May 2025 to July 2025",
            "observedAt": "2025-07-31T00:00:00.000Z",
            "value": 4.7
          },
          {
            "period": "June 2025 to August 2025",
            "observedAt": "2025-08-31T00:00:00.000Z",
            "value": 4.8
          },
          {
            "period": "July 2025 to September 2025",
            "observedAt": "2025-09-30T00:00:00.000Z",
            "value": 5
          },
          {
            "period": "August 2025 to October 2025",
            "observedAt": "2025-10-31T00:00:00.000Z",
            "value": 5.1
          },
          {
            "period": "September 2025 to November 2025",
            "observedAt": "2025-11-30T00:00:00.000Z",
            "value": 5.1
          },
          {
            "period": "October 2025 to December 2025",
            "observedAt": "2025-12-31T00:00:00.000Z",
            "value": 5.2
          },
          {
            "period": "November 2025 to January 2026",
            "observedAt": "2026-01-31T00:00:00.000Z",
            "value": 5.2
          },
          {
            "period": "December 2025 to February 2026",
            "observedAt": "2026-02-28T00:00:00.000Z",
            "value": 4.9
          },
          {
            "period": "January 2026 to March 2026",
            "observedAt": "2026-03-31T00:00:00.000Z",
            "value": 5
          },
          {
            "period": "February 2026 to April 2026",
            "observedAt": "2026-04-30T00:00:00.000Z",
            "value": 4.9
          },
          {
            "period": "March 2026 to May 2026",
            "observedAt": "2026-05-31T00:00:00.000Z",
            "value": 4.9
          },
          {
            "period": "April 2026 to June 2026",
            "observedAt": "2026-06-30T00:00:00.000Z",
            "value": 4.9
          },
          {
            "period": "May 2026 to July 2026",
            "observedAt": "2026-07-31T00:00:00.000Z",
            "value": 4.9
          }
        ]
      }
    },
    "methodology": {
      "alignment": "Each series keeps its own observation period, publication date, retrieval time and revision status. public-data.org does not carry values forward onto another series' timeline.",
      "evidenceClass": "official-data"
    },
    "__observation": {
      "status": "current",
      "period": "Inflation August 2026 · Bank Rate 18 December 2025 · Unemployment May 2026 to July 2026",
      "observedAt": "2026-08-31T00:00:00.000Z",
      "checkedAt": "2026-10-01T15:26:07.735Z",
      "maxAgeDays": 75
    },
    "__provenance": {
      "registryVersion": "2026-08-02.1",
      "section": "sentimentPulse",
      "title": "Series-level economic indicators",
      "evidenceClass": "official-data",
      "geography": "United Kingdom",
      "retrieval": "scheduled-publication-check",
      "refreshCadence": "daily",
      "publicationCadence": "series-specific: monthly and event-driven",
      "operationalStatus": "active",
      "publicationRequirement": "required",
      "upstreams": [
        {
          "publisher": "Office for National Statistics",
          "label": "CPI annual rate D7G7 / MM23",
          "seriesId": "D7G7",
          "datasetId": "MM23",
          "url": "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
          "sourceClass": "official-primary",
          "caveat": "The Worker retrieves the official monthly CSV and the series page release metadata; the observation and publication clocks are retained separately."
        },
        {
          "publisher": "Bank of England",
          "label": "Official Bank Rate IUDBEDR / IADB",
          "seriesId": "IUDBEDR",
          "datasetId": "IADB",
          "url": "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp",
          "sourceClass": "official-primary",
          "caveat": "Bank Rate is event-dated and remains current until a later Monetary Policy Committee decision changes it."
        },
        {
          "publisher": "Office for National Statistics",
          "label": "Unemployment rate MGSX / LMS",
          "seriesId": "MGSX",
          "datasetId": "LMS",
          "url": "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
          "sourceClass": "official-primary",
          "caveat": "MGSX is a rolling three-month Labour Force Survey estimate. Its period is not aligned to the CPI month."
        }
      ]
    }
  },
  "taxRevenue": {
    "available": true,
    "headline": {
      "period": "August 2026",
      "observedAt": 1788134400000,
      "releaseDate": "2026-09-22",
      "receiptsBillion": 89.8,
      "yearChangeBillion": 3.3
    },
    "methodology": {
      "measure": "Total current central government receipts",
      "status": "Official statistics",
      "caveat": "This ONS public-sector-finance measure is not the same as a tax forecast, tax-burden ratio or category-by-category HMRC receipts table."
    },
    "source": {
      "bulletinUrl": "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/august2026",
      "landingUrl": "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/latest"
    },
    "expiresAt": "2026-12-01T00:00:00.000Z",
    "history": [
      {
        "period": "September 2016",
        "observedAt": 1475193600000,
        "receiptsBillion": 53.7
      },
      {
        "period": "October 2016",
        "observedAt": 1477872000000,
        "receiptsBillion": 56.8
      },
      {
        "period": "November 2016",
        "observedAt": 1480464000000,
        "receiptsBillion": 52.8
      },
      {
        "period": "December 2016",
        "observedAt": 1483142400000,
        "receiptsBillion": 55.7
      },
      {
        "period": "January 2017",
        "observedAt": 1485820800000,
        "receiptsBillion": 75.2
      },
      {
        "period": "February 2017",
        "observedAt": 1488240000000,
        "receiptsBillion": 61.9
      },
      {
        "period": "March 2017",
        "observedAt": 1490918400000,
        "receiptsBillion": 60.7
      },
      {
        "period": "April 2017",
        "observedAt": 1493510400000,
        "receiptsBillion": 59.4
      },
      {
        "period": "May 2017",
        "observedAt": 1496188800000,
        "receiptsBillion": 54.2
      },
      {
        "period": "June 2017",
        "observedAt": 1498780800000,
        "receiptsBillion": 56.2
      },
      {
        "period": "July 2017",
        "observedAt": 1501459200000,
        "receiptsBillion": 63.5
      },
      {
        "period": "August 2017",
        "observedAt": 1504137600000,
        "receiptsBillion": 55.8
      },
      {
        "period": "September 2017",
        "observedAt": 1506729600000,
        "receiptsBillion": 55.9
      },
      {
        "period": "October 2017",
        "observedAt": 1509408000000,
        "receiptsBillion": 60.5
      },
      {
        "period": "November 2017",
        "observedAt": 1512000000000,
        "receiptsBillion": 55.8
      },
      {
        "period": "December 2017",
        "observedAt": 1514678400000,
        "receiptsBillion": 58.5
      },
      {
        "period": "January 2018",
        "observedAt": 1517356800000,
        "receiptsBillion": 72.8
      },
      {
        "period": "February 2018",
        "observedAt": 1519776000000,
        "receiptsBillion": 62.3
      },
      {
        "period": "March 2018",
        "observedAt": 1522454400000,
        "receiptsBillion": 62.6
      },
      {
        "period": "April 2018",
        "observedAt": 1525046400000,
        "receiptsBillion": 61.5
      },
      {
        "period": "May 2018",
        "observedAt": 1527724800000,
        "receiptsBillion": 56.2
      },
      {
        "period": "June 2018",
        "observedAt": 1530316800000,
        "receiptsBillion": 58.8
      },
      {
        "period": "July 2018",
        "observedAt": 1532995200000,
        "receiptsBillion": 68.9
      },
      {
        "period": "August 2018",
        "observedAt": 1535673600000,
        "receiptsBillion": 57.8
      },
      {
        "period": "September 2018",
        "observedAt": 1538265600000,
        "receiptsBillion": 57.7
      },
      {
        "period": "October 2018",
        "observedAt": 1540944000000,
        "receiptsBillion": 61.8
      },
      {
        "period": "November 2018",
        "observedAt": 1543536000000,
        "receiptsBillion": 57.5
      },
      {
        "period": "December 2018",
        "observedAt": 1546214400000,
        "receiptsBillion": 60.3
      },
      {
        "period": "January 2019",
        "observedAt": 1548892800000,
        "receiptsBillion": 79.2
      },
      {
        "period": "February 2019",
        "observedAt": 1551312000000,
        "receiptsBillion": 63.8
      },
      {
        "period": "March 2019",
        "observedAt": 1553990400000,
        "receiptsBillion": 67.5
      },
      {
        "period": "April 2019",
        "observedAt": 1556582400000,
        "receiptsBillion": 62.4
      },
      {
        "period": "May 2019",
        "observedAt": 1559260800000,
        "receiptsBillion": 58.2
      },
      {
        "period": "June 2019",
        "observedAt": 1561852800000,
        "receiptsBillion": 59.9
      },
      {
        "period": "July 2019",
        "observedAt": 1564531200000,
        "receiptsBillion": 68.4
      },
      {
        "period": "August 2019",
        "observedAt": 1567209600000,
        "receiptsBillion": 59.9
      },
      {
        "period": "September 2019",
        "observedAt": 1569801600000,
        "receiptsBillion": 60.3
      },
      {
        "period": "October 2019",
        "observedAt": 1572480000000,
        "receiptsBillion": 61.1
      },
      {
        "period": "November 2019",
        "observedAt": 1575072000000,
        "receiptsBillion": 57.7
      },
      {
        "period": "December 2019",
        "observedAt": 1577750400000,
        "receiptsBillion": 61
      },
      {
        "period": "January 2020",
        "observedAt": 1580428800000,
        "receiptsBillion": 80.2
      },
      {
        "period": "February 2020",
        "observedAt": 1582934400000,
        "receiptsBillion": 63.9
      },
      {
        "period": "March 2020",
        "observedAt": 1585612800000,
        "receiptsBillion": 65.5
      },
      {
        "period": "April 2020",
        "observedAt": 1588204800000,
        "receiptsBillion": 52.8
      },
      {
        "period": "May 2020",
        "observedAt": 1590883200000,
        "receiptsBillion": 49.3
      },
      {
        "period": "June 2020",
        "observedAt": 1593475200000,
        "receiptsBillion": 52.1
      },
      {
        "period": "July 2020",
        "observedAt": 1596153600000,
        "receiptsBillion": 60.6
      },
      {
        "period": "August 2020",
        "observedAt": 1598832000000,
        "receiptsBillion": 56.9
      },
      {
        "period": "September 2020",
        "observedAt": 1601424000000,
        "receiptsBillion": 56.3
      },
      {
        "period": "October 2020",
        "observedAt": 1604102400000,
        "receiptsBillion": 62.3
      },
      {
        "period": "November 2020",
        "observedAt": 1606694400000,
        "receiptsBillion": 58.9
      },
      {
        "period": "December 2020",
        "observedAt": 1609372800000,
        "receiptsBillion": 62.2
      },
      {
        "period": "January 2021",
        "observedAt": 1612051200000,
        "receiptsBillion": 83.2
      },
      {
        "period": "February 2021",
        "observedAt": 1614470400000,
        "receiptsBillion": 65.3
      },
      {
        "period": "March 2021",
        "observedAt": 1617148800000,
        "receiptsBillion": 66.9
      },
      {
        "period": "April 2021",
        "observedAt": 1619740800000,
        "receiptsBillion": 60.4
      },
      {
        "period": "May 2021",
        "observedAt": 1622419200000,
        "receiptsBillion": 61.3
      },
      {
        "period": "June 2021",
        "observedAt": 1625011200000,
        "receiptsBillion": 62.3
      },
      {
        "period": "July 2021",
        "observedAt": 1627689600000,
        "receiptsBillion": 73
      },
      {
        "period": "August 2021",
        "observedAt": 1630368000000,
        "receiptsBillion": 64.5
      },
      {
        "period": "September 2021",
        "observedAt": 1632960000000,
        "receiptsBillion": 65.1
      },
      {
        "period": "October 2021",
        "observedAt": 1635638400000,
        "receiptsBillion": 71.7
      },
      {
        "period": "November 2021",
        "observedAt": 1638230400000,
        "receiptsBillion": 66.8
      },
      {
        "period": "December 2021",
        "observedAt": 1640908800000,
        "receiptsBillion": 71.5
      },
      {
        "period": "January 2022",
        "observedAt": 1643587200000,
        "receiptsBillion": 95.3
      },
      {
        "period": "February 2022",
        "observedAt": 1646006400000,
        "receiptsBillion": 73.3
      },
      {
        "period": "March 2022",
        "observedAt": 1648684800000,
        "receiptsBillion": 79.3
      },
      {
        "period": "April 2022",
        "observedAt": 1651276800000,
        "receiptsBillion": 72.9
      },
      {
        "period": "May 2022",
        "observedAt": 1653955200000,
        "receiptsBillion": 70.1
      },
      {
        "period": "June 2022",
        "observedAt": 1656547200000,
        "receiptsBillion": 72.2
      },
      {
        "period": "July 2022",
        "observedAt": 1659225600000,
        "receiptsBillion": 82.2
      },
      {
        "period": "August 2022",
        "observedAt": 1661904000000,
        "receiptsBillion": 74
      },
      {
        "period": "September 2022",
        "observedAt": 1664496000000,
        "receiptsBillion": 74.7
      },
      {
        "period": "October 2022",
        "observedAt": 1667174400000,
        "receiptsBillion": 74.9
      },
      {
        "period": "November 2022",
        "observedAt": 1669766400000,
        "receiptsBillion": 74.5
      },
      {
        "period": "December 2022",
        "observedAt": 1672444800000,
        "receiptsBillion": 77.2
      },
      {
        "period": "January 2023",
        "observedAt": 1675123200000,
        "receiptsBillion": 107.6
      },
      {
        "period": "February 2023",
        "observedAt": 1677542400000,
        "receiptsBillion": 79.3
      },
      {
        "period": "March 2023",
        "observedAt": 1680220800000,
        "receiptsBillion": 85.1
      },
      {
        "period": "April 2023",
        "observedAt": 1682812800000,
        "receiptsBillion": 75.5
      },
      {
        "period": "May 2023",
        "observedAt": 1685491200000,
        "receiptsBillion": 75.9
      },
      {
        "period": "June 2023",
        "observedAt": 1688083200000,
        "receiptsBillion": 78.6
      },
      {
        "period": "July 2023",
        "observedAt": 1690761600000,
        "receiptsBillion": 89
      },
      {
        "period": "August 2023",
        "observedAt": 1693440000000,
        "receiptsBillion": 77.3
      },
      {
        "period": "September 2023",
        "observedAt": 1696032000000,
        "receiptsBillion": 77.3
      },
      {
        "period": "October 2023",
        "observedAt": 1698710400000,
        "receiptsBillion": 78.4
      },
      {
        "period": "November 2023",
        "observedAt": 1701302400000,
        "receiptsBillion": 78.5
      },
      {
        "period": "December 2023",
        "observedAt": 1703980800000,
        "receiptsBillion": 83.2
      },
      {
        "period": "January 2024",
        "observedAt": 1706659200000,
        "receiptsBillion": 109.2
      },
      {
        "period": "February 2024",
        "observedAt": 1709164800000,
        "receiptsBillion": 83.9
      },
      {
        "period": "March 2024",
        "observedAt": 1711843200000,
        "receiptsBillion": 90.6
      },
      {
        "period": "April 2024",
        "observedAt": 1714435200000,
        "receiptsBillion": 78
      },
      {
        "period": "May 2024",
        "observedAt": 1717113600000,
        "receiptsBillion": 77.4
      },
      {
        "period": "June 2024",
        "observedAt": 1719705600000,
        "receiptsBillion": 81.3
      },
      {
        "period": "July 2024",
        "observedAt": 1722384000000,
        "receiptsBillion": 91.5
      },
      {
        "period": "August 2024",
        "observedAt": 1725062400000,
        "receiptsBillion": 80.2
      },
      {
        "period": "September 2024",
        "observedAt": 1727654400000,
        "receiptsBillion": 79.6
      },
      {
        "period": "October 2024",
        "observedAt": 1730332800000,
        "receiptsBillion": 80.7
      },
      {
        "period": "November 2024",
        "observedAt": 1732924800000,
        "receiptsBillion": 81
      },
      {
        "period": "December 2024",
        "observedAt": 1735603200000,
        "receiptsBillion": 86.5
      },
      {
        "period": "January 2025",
        "observedAt": 1738281600000,
        "receiptsBillion": 117.4
      },
      {
        "period": "February 2025",
        "observedAt": 1740700800000,
        "receiptsBillion": 87.3
      },
      {
        "period": "March 2025",
        "observedAt": 1743379200000,
        "receiptsBillion": 96.9
      },
      {
        "period": "April 2025",
        "observedAt": 1745971200000,
        "receiptsBillion": 83.2
      },
      {
        "period": "May 2025",
        "observedAt": 1748649600000,
        "receiptsBillion": 82.1
      },
      {
        "period": "June 2025",
        "observedAt": 1751241600000,
        "receiptsBillion": 85.4
      },
      {
        "period": "July 2025",
        "observedAt": 1753920000000,
        "receiptsBillion": 99.9
      },
      {
        "period": "August 2025",
        "observedAt": 1756598400000,
        "receiptsBillion": 86.5
      },
      {
        "period": "September 2025",
        "observedAt": 1759190400000,
        "receiptsBillion": 85.6
      },
      {
        "period": "October 2025",
        "observedAt": 1761868800000,
        "receiptsBillion": 86.9
      },
      {
        "period": "November 2025",
        "observedAt": 1764460800000,
        "receiptsBillion": 87.6
      },
      {
        "period": "December 2025",
        "observedAt": 1767139200000,
        "receiptsBillion": 93.1
      },
      {
        "period": "January 2026",
        "observedAt": 1769817600000,
        "receiptsBillion": 134.1
      },
      {
        "period": "February 2026",
        "observedAt": 1772236800000,
        "receiptsBillion": 96.4
      },
      {
        "period": "March 2026",
        "observedAt": 1774915200000,
        "receiptsBillion": 102.6
      },
      {
        "period": "April 2026",
        "observedAt": 1777507200000,
        "receiptsBillion": 85.4
      },
      {
        "period": "May 2026",
        "observedAt": 1780185600000,
        "receiptsBillion": 87.6
      },
      {
        "period": "June 2026",
        "observedAt": 1782777600000,
        "receiptsBillion": 93.3
      },
      {
        "period": "July 2026",
        "observedAt": 1785456000000,
        "receiptsBillion": 104.6
      },
      {
        "period": "August 2026",
        "observedAt": 1788134400000,
        "receiptsBillion": 89.8
      }
    ],
    "series": {
      "receipts": "ANBV",
      "url": "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/anbv/pusf"
    },
    "__observation": {
      "status": "current",
      "period": "August 2026",
      "observedAt": "2026-08-31T00:00:00.000Z",
      "checkedAt": "2026-10-01T15:26:32.675Z",
      "maxAgeDays": 70
    }
  },
  "nationalDebt": {
    "baseDebt": 2985500000000,
    "baseDate": 1788134400000,
    "debtToGdp": 93.8,
    "observationPeriod": "2026 AUG",
    "publicationDate": "2026-09-22",
    "annualDelta": {
      "debtBillion": 78.5,
      "debtToGdpPoints": -1.3
    },
    "history": [
      {
        "period": "2016 SEP",
        "observedAt": 1475193600000,
        "debtBillion": 1628.7,
        "debtToGdp": 80.3
      },
      {
        "period": "2016 OCT",
        "observedAt": 1477872000000,
        "debtBillion": 1640.7,
        "debtToGdp": 80.6
      },
      {
        "period": "2016 NOV",
        "observedAt": 1480464000000,
        "debtBillion": 1658.7,
        "debtToGdp": 81.2
      },
      {
        "period": "2016 DEC",
        "observedAt": 1483142400000,
        "debtBillion": 1690.7,
        "debtToGdp": 82.5
      },
      {
        "period": "2017 JAN",
        "observedAt": 1485820800000,
        "debtBillion": 1661,
        "debtToGdp": 80.7
      },
      {
        "period": "2017 FEB",
        "observedAt": 1488240000000,
        "debtBillion": 1683.9,
        "debtToGdp": 81.5
      },
      {
        "period": "2017 MAR",
        "observedAt": 1490918400000,
        "debtBillion": 1714.6,
        "debtToGdp": 82.7
      },
      {
        "period": "2017 APR",
        "observedAt": 1493510400000,
        "debtBillion": 1713.5,
        "debtToGdp": 82.3
      },
      {
        "period": "2017 MAY",
        "observedAt": 1496188800000,
        "debtBillion": 1727.5,
        "debtToGdp": 82.7
      },
      {
        "period": "2017 JUN",
        "observedAt": 1498780800000,
        "debtBillion": 1750.7,
        "debtToGdp": 83.5
      },
      {
        "period": "2017 JUL",
        "observedAt": 1501459200000,
        "debtBillion": 1749.8,
        "debtToGdp": 83.2
      },
      {
        "period": "2017 AUG",
        "observedAt": 1504137600000,
        "debtBillion": 1751.5,
        "debtToGdp": 83.1
      },
      {
        "period": "2017 SEP",
        "observedAt": 1506729600000,
        "debtBillion": 1774.7,
        "debtToGdp": 83.9
      },
      {
        "period": "2017 OCT",
        "observedAt": 1509408000000,
        "debtBillion": 1760.4,
        "debtToGdp": 83
      },
      {
        "period": "2017 NOV",
        "observedAt": 1512000000000,
        "debtBillion": 1750,
        "debtToGdp": 82.2
      },
      {
        "period": "2017 DEC",
        "observedAt": 1514678400000,
        "debtBillion": 1746.4,
        "debtToGdp": 81.8
      },
      {
        "period": "2018 JAN",
        "observedAt": 1517356800000,
        "debtBillion": 1728.9,
        "debtToGdp": 80.8
      },
      {
        "period": "2018 FEB",
        "observedAt": 1519776000000,
        "debtBillion": 1754,
        "debtToGdp": 81.7
      },
      {
        "period": "2018 MAR",
        "observedAt": 1522454400000,
        "debtBillion": 1760.1,
        "debtToGdp": 81.7
      },
      {
        "period": "2018 APR",
        "observedAt": 1525046400000,
        "debtBillion": 1772.1,
        "debtToGdp": 82
      },
      {
        "period": "2018 MAY",
        "observedAt": 1527724800000,
        "debtBillion": 1774.3,
        "debtToGdp": 81.9
      },
      {
        "period": "2018 JUN",
        "observedAt": 1530316800000,
        "debtBillion": 1782.1,
        "debtToGdp": 82.1
      },
      {
        "period": "2018 JUL",
        "observedAt": 1532995200000,
        "debtBillion": 1764.4,
        "debtToGdp": 81
      },
      {
        "period": "2018 AUG",
        "observedAt": 1535673600000,
        "debtBillion": 1772.6,
        "debtToGdp": 81.2
      },
      {
        "period": "2018 SEP",
        "observedAt": 1538265600000,
        "debtBillion": 1777.9,
        "debtToGdp": 81.2
      },
      {
        "period": "2018 OCT",
        "observedAt": 1540944000000,
        "debtBillion": 1783.7,
        "debtToGdp": 81.2
      },
      {
        "period": "2018 NOV",
        "observedAt": 1543536000000,
        "debtBillion": 1789,
        "debtToGdp": 81.2
      },
      {
        "period": "2018 DEC",
        "observedAt": 1546214400000,
        "debtBillion": 1800.7,
        "debtToGdp": 81.4
      },
      {
        "period": "2019 JAN",
        "observedAt": 1548892800000,
        "debtBillion": 1771.4,
        "debtToGdp": 79.9
      },
      {
        "period": "2019 FEB",
        "observedAt": 1551312000000,
        "debtBillion": 1774.6,
        "debtToGdp": 79.8
      },
      {
        "period": "2019 MAR",
        "observedAt": 1553990400000,
        "debtBillion": 1778,
        "debtToGdp": 79.7
      },
      {
        "period": "2019 APR",
        "observedAt": 1556582400000,
        "debtBillion": 1788.7,
        "debtToGdp": 79.9
      },
      {
        "period": "2019 MAY",
        "observedAt": 1559260800000,
        "debtBillion": 1798,
        "debtToGdp": 80.1
      },
      {
        "period": "2019 JUN",
        "observedAt": 1561852800000,
        "debtBillion": 1810,
        "debtToGdp": 80.3
      },
      {
        "period": "2019 JUL",
        "observedAt": 1564531200000,
        "debtBillion": 1795.5,
        "debtToGdp": 79.6
      },
      {
        "period": "2019 AUG",
        "observedAt": 1567209600000,
        "debtBillion": 1793.2,
        "debtToGdp": 79.3
      },
      {
        "period": "2019 SEP",
        "observedAt": 1569801600000,
        "debtBillion": 1808.5,
        "debtToGdp": 79.9
      },
      {
        "period": "2019 OCT",
        "observedAt": 1572480000000,
        "debtBillion": 1822.1,
        "debtToGdp": 81.5
      },
      {
        "period": "2019 NOV",
        "observedAt": 1575072000000,
        "debtBillion": 1828.1,
        "debtToGdp": 82.8
      },
      {
        "period": "2019 DEC",
        "observedAt": 1577750400000,
        "debtBillion": 1837.2,
        "debtToGdp": 84.2
      },
      {
        "period": "2020 JAN",
        "observedAt": 1580428800000,
        "debtBillion": 1812.3,
        "debtToGdp": 83.5
      },
      {
        "period": "2020 FEB",
        "observedAt": 1582934400000,
        "debtBillion": 1807.8,
        "debtToGdp": 83.7
      },
      {
        "period": "2020 MAR",
        "observedAt": 1585612800000,
        "debtBillion": 1814.8,
        "debtToGdp": 84.5
      },
      {
        "period": "2020 APR",
        "observedAt": 1588204800000,
        "debtBillion": 1917.3,
        "debtToGdp": 89.6
      },
      {
        "period": "2020 MAY",
        "observedAt": 1590883200000,
        "debtBillion": 1988.6,
        "debtToGdp": 93.2
      },
      {
        "period": "2020 JUN",
        "observedAt": 1593475200000,
        "debtBillion": 2024.3,
        "debtToGdp": 95.3
      },
      {
        "period": "2020 JUL",
        "observedAt": 1596153600000,
        "debtBillion": 2035.5,
        "debtToGdp": 96
      },
      {
        "period": "2020 AUG",
        "observedAt": 1598832000000,
        "debtBillion": 2067,
        "debtToGdp": 97.7
      },
      {
        "period": "2020 SEP",
        "observedAt": 1601424000000,
        "debtBillion": 2069.8,
        "debtToGdp": 98.1
      },
      {
        "period": "2020 OCT",
        "observedAt": 1604102400000,
        "debtBillion": 2101.1,
        "debtToGdp": 98.1
      },
      {
        "period": "2020 NOV",
        "observedAt": 1606694400000,
        "debtBillion": 2130.1,
        "debtToGdp": 98
      },
      {
        "period": "2020 DEC",
        "observedAt": 1609372800000,
        "debtBillion": 2154.2,
        "debtToGdp": 97.7
      },
      {
        "period": "2021 JAN",
        "observedAt": 1612051200000,
        "debtBillion": 2135.9,
        "debtToGdp": 96.1
      },
      {
        "period": "2021 FEB",
        "observedAt": 1614470400000,
        "debtBillion": 2159.5,
        "debtToGdp": 96.3
      },
      {
        "period": "2021 MAR",
        "observedAt": 1617148800000,
        "debtBillion": 2157.7,
        "debtToGdp": 95.5
      },
      {
        "period": "2021 APR",
        "observedAt": 1619740800000,
        "debtBillion": 2194,
        "debtToGdp": 96.2
      },
      {
        "period": "2021 MAY",
        "observedAt": 1622419200000,
        "debtBillion": 2220.1,
        "debtToGdp": 96.5
      },
      {
        "period": "2021 JUN",
        "observedAt": 1625011200000,
        "debtBillion": 2227.1,
        "debtToGdp": 95.9
      },
      {
        "period": "2021 JUL",
        "observedAt": 1627689600000,
        "debtBillion": 2240.4,
        "debtToGdp": 95.4
      },
      {
        "period": "2021 AUG",
        "observedAt": 1630368000000,
        "debtBillion": 2230.2,
        "debtToGdp": 93.9
      },
      {
        "period": "2021 SEP",
        "observedAt": 1632960000000,
        "debtBillion": 2237.3,
        "debtToGdp": 93.2
      },
      {
        "period": "2021 OCT",
        "observedAt": 1635638400000,
        "debtBillion": 2321.8,
        "debtToGdp": 95.9
      },
      {
        "period": "2021 NOV",
        "observedAt": 1638230400000,
        "debtBillion": 2352.2,
        "debtToGdp": 96.4
      },
      {
        "period": "2021 DEC",
        "observedAt": 1640908800000,
        "debtBillion": 2364.5,
        "debtToGdp": 96.2
      },
      {
        "period": "2022 JAN",
        "observedAt": 1643587200000,
        "debtBillion": 2351.1,
        "debtToGdp": 94.8
      },
      {
        "period": "2022 FEB",
        "observedAt": 1646006400000,
        "debtBillion": 2352.2,
        "debtToGdp": 94
      },
      {
        "period": "2022 MAR",
        "observedAt": 1648684800000,
        "debtBillion": 2379.7,
        "debtToGdp": 94.3
      },
      {
        "period": "2022 APR",
        "observedAt": 1651276800000,
        "debtBillion": 2383.1,
        "debtToGdp": 93.7
      },
      {
        "period": "2022 MAY",
        "observedAt": 1653955200000,
        "debtBillion": 2400.4,
        "debtToGdp": 93.7
      },
      {
        "period": "2022 JUN",
        "observedAt": 1656547200000,
        "debtBillion": 2424.5,
        "debtToGdp": 93.9
      },
      {
        "period": "2022 JUL",
        "observedAt": 1659225600000,
        "debtBillion": 2419.3,
        "debtToGdp": 93.1
      },
      {
        "period": "2022 AUG",
        "observedAt": 1661904000000,
        "debtBillion": 2428.8,
        "debtToGdp": 92.8
      },
      {
        "period": "2022 SEP",
        "observedAt": 1664496000000,
        "debtBillion": 2442,
        "debtToGdp": 92.7
      },
      {
        "period": "2022 OCT",
        "observedAt": 1667174400000,
        "debtBillion": 2453.5,
        "debtToGdp": 92.5
      },
      {
        "period": "2022 NOV",
        "observedAt": 1669766400000,
        "debtBillion": 2476.7,
        "debtToGdp": 92.8
      },
      {
        "period": "2022 DEC",
        "observedAt": 1672444800000,
        "debtBillion": 2499.2,
        "debtToGdp": 93.1
      },
      {
        "period": "2023 JAN",
        "observedAt": 1675123200000,
        "debtBillion": 2486.8,
        "debtToGdp": 92.1
      },
      {
        "period": "2023 FEB",
        "observedAt": 1677542400000,
        "debtBillion": 2511,
        "debtToGdp": 92.5
      },
      {
        "period": "2023 MAR",
        "observedAt": 1680220800000,
        "debtBillion": 2542.7,
        "debtToGdp": 93.1
      },
      {
        "period": "2023 APR",
        "observedAt": 1682812800000,
        "debtBillion": 2550,
        "debtToGdp": 93.1
      },
      {
        "period": "2023 MAY",
        "observedAt": 1685491200000,
        "debtBillion": 2579.6,
        "debtToGdp": 94
      },
      {
        "period": "2023 JUN",
        "observedAt": 1688083200000,
        "debtBillion": 2608.5,
        "debtToGdp": 94.8
      },
      {
        "period": "2023 JUL",
        "observedAt": 1690761600000,
        "debtBillion": 2590,
        "debtToGdp": 93.7
      },
      {
        "period": "2023 AUG",
        "observedAt": 1693440000000,
        "debtBillion": 2605,
        "debtToGdp": 93.8
      },
      {
        "period": "2023 SEP",
        "observedAt": 1696032000000,
        "debtBillion": 2607.7,
        "debtToGdp": 93.5
      },
      {
        "period": "2023 OCT",
        "observedAt": 1698710400000,
        "debtBillion": 2648.8,
        "debtToGdp": 94.6
      },
      {
        "period": "2023 NOV",
        "observedAt": 1701302400000,
        "debtBillion": 2675.6,
        "debtToGdp": 95.2
      },
      {
        "period": "2023 DEC",
        "observedAt": 1703980800000,
        "debtBillion": 2694,
        "debtToGdp": 95.5
      },
      {
        "period": "2024 JAN",
        "observedAt": 1706659200000,
        "debtBillion": 2652.6,
        "debtToGdp": 93.7
      },
      {
        "period": "2024 FEB",
        "observedAt": 1709164800000,
        "debtBillion": 2669,
        "debtToGdp": 93.9
      },
      {
        "period": "2024 MAR",
        "observedAt": 1711843200000,
        "debtBillion": 2684.1,
        "debtToGdp": 94.1
      },
      {
        "period": "2024 APR",
        "observedAt": 1714435200000,
        "debtBillion": 2674.5,
        "debtToGdp": 93.4
      },
      {
        "period": "2024 MAY",
        "observedAt": 1717113600000,
        "debtBillion": 2719.2,
        "debtToGdp": 94.5
      },
      {
        "period": "2024 JUN",
        "observedAt": 1719705600000,
        "debtBillion": 2730.3,
        "debtToGdp": 94.5
      },
      {
        "period": "2024 JUL",
        "observedAt": 1722384000000,
        "debtBillion": 2735.2,
        "debtToGdp": 94.2
      },
      {
        "period": "2024 AUG",
        "observedAt": 1725062400000,
        "debtBillion": 2757.9,
        "debtToGdp": 94.5
      },
      {
        "period": "2024 SEP",
        "observedAt": 1727654400000,
        "debtBillion": 2757.9,
        "debtToGdp": 94
      },
      {
        "period": "2024 OCT",
        "observedAt": 1730332800000,
        "debtBillion": 2780.7,
        "debtToGdp": 94.4
      },
      {
        "period": "2024 NOV",
        "observedAt": 1732924800000,
        "debtBillion": 2815.8,
        "debtToGdp": 95.2
      },
      {
        "period": "2024 DEC",
        "observedAt": 1735603200000,
        "debtBillion": 2816.4,
        "debtToGdp": 94.8
      },
      {
        "period": "2025 JAN",
        "observedAt": 1738281600000,
        "debtBillion": 2775.2,
        "debtToGdp": 93.1
      },
      {
        "period": "2025 FEB",
        "observedAt": 1740700800000,
        "debtBillion": 2796,
        "debtToGdp": 93.4
      },
      {
        "period": "2025 MAR",
        "observedAt": 1743379200000,
        "debtBillion": 2806.7,
        "debtToGdp": 93.4
      },
      {
        "period": "2025 APR",
        "observedAt": 1745971200000,
        "debtBillion": 2826.2,
        "debtToGdp": 93.8
      },
      {
        "period": "2025 MAY",
        "observedAt": 1748649600000,
        "debtBillion": 2868.7,
        "debtToGdp": 94.9
      },
      {
        "period": "2025 JUN",
        "observedAt": 1751241600000,
        "debtBillion": 2868.4,
        "debtToGdp": 94.5
      },
      {
        "period": "2025 JUL",
        "observedAt": 1753920000000,
        "debtBillion": 2889.5,
        "debtToGdp": 94.9
      },
      {
        "period": "2025 AUG",
        "observedAt": 1756598400000,
        "debtBillion": 2907,
        "debtToGdp": 95.1
      },
      {
        "period": "2025 SEP",
        "observedAt": 1759190400000,
        "debtBillion": 2913.3,
        "debtToGdp": 94.9
      },
      {
        "period": "2025 OCT",
        "observedAt": 1761868800000,
        "debtBillion": 2896.5,
        "debtToGdp": 94
      },
      {
        "period": "2025 NOV",
        "observedAt": 1764460800000,
        "debtBillion": 2926.3,
        "debtToGdp": 94.6
      },
      {
        "period": "2025 DEC",
        "observedAt": 1767139200000,
        "debtBillion": 2924.5,
        "debtToGdp": 94.2
      },
      {
        "period": "2026 JAN",
        "observedAt": 1769817600000,
        "debtBillion": 2870.4,
        "debtToGdp": 92.3
      },
      {
        "period": "2026 FEB",
        "observedAt": 1772236800000,
        "debtBillion": 2886.9,
        "debtToGdp": 92.6
      },
      {
        "period": "2026 MAR",
        "observedAt": 1774915200000,
        "debtBillion": 2916.8,
        "debtToGdp": 93.3
      },
      {
        "period": "2026 APR",
        "observedAt": 1777507200000,
        "debtBillion": 2938.2,
        "debtToGdp": 93.6
      },
      {
        "period": "2026 MAY",
        "observedAt": 1780185600000,
        "debtBillion": 2972.6,
        "debtToGdp": 94.3
      },
      {
        "period": "2026 JUN",
        "observedAt": 1782777600000,
        "debtBillion": 2992.5,
        "debtToGdp": 94.6
      },
      {
        "period": "2026 JUL",
        "observedAt": 1785456000000,
        "debtBillion": 2982,
        "debtToGdp": 94
      },
      {
        "period": "2026 AUG",
        "observedAt": 1788134400000,
        "debtBillion": 2985.5,
        "debtToGdp": 93.8
      }
    ],
    "revisionStatus": "Public-sector-finance estimates can be revised as source data and classifications are updated.",
    "source": {
      "publisher": "Office for National Statistics",
      "debtUrl": "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf",
      "debtToGdpUrl": "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf"
    },
    "series": {
      "debt": "HF6W",
      "debtToGdp": "HF6X"
    },
    "__observation": {
      "status": "current",
      "period": "2026 AUG",
      "observedAt": "2026-08-31T00:00:00.000Z",
      "checkedAt": "2026-10-01T15:26:35.446Z",
      "maxAgeDays": 75
    },
    "__provenance": {
      "registryVersion": "2026-08-02.1",
      "section": "nationalDebt",
      "title": "Public sector net debt excluding public sector banks",
      "evidenceClass": "official-data",
      "geography": "United Kingdom",
      "retrieval": "scheduled-publication-check",
      "refreshCadence": "daily",
      "publicationCadence": "monthly",
      "operationalStatus": "active",
      "publicationRequirement": "required",
      "upstreams": [
        {
          "publisher": "Office for National Statistics",
          "label": "Public sector net debt excluding public sector banks",
          "seriesId": "HF6W",
          "datasetId": "PUSF",
          "url": "https://www.ons.gov.uk/generator?format=csv&uri=/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf",
          "sourceClass": "official-primary"
        },
        {
          "publisher": "Office for National Statistics",
          "label": "Public sector net debt excluding public sector banks as a percentage of GDP",
          "seriesId": "HF6X",
          "datasetId": "PUSF",
          "url": "https://www.ons.gov.uk/generator?format=csv&uri=/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf",
          "sourceClass": "official-primary"
        }
      ]
    }
  },
  "crimeStatistics": {
    "available": true,
    "expiresAt": "2026-10-22T00:00:00.000Z",
    "headline": {
      "publisher": "Office for National Statistics",
      "publicationTitle": "Crime in England and Wales: year ending March 2026",
      "publicationUrl": "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/yearendingmarch2026",
      "period": "Year ending March 2026",
      "observedAt": "2026-03-31",
      "releaseDate": "2026-07-23",
      "nextReleaseDate": "2026-10-22",
      "geography": "England and Wales"
    },
    "crimeSurvey": {
      "status": "available",
      "title": "Crime experienced by households and individuals",
      "sourceLabel": "Crime Survey for England and Wales (CSEW)",
      "summary": "9.6 million CSEW headline crime incidents were estimated in the latest survey, with no statistically significant annual change.",
      "caveat": "The CSEW is the preferred measure for long-term trends in common crimes. Estimates cover people aged 16 and over, exclude some populations and are subject to sampling uncertainty.",
      "measures": [
        {
          "id": "headlineCrime",
          "label": "Headline crime",
          "value": 9600000,
          "displayValue": "9.6 million",
          "unit": "estimated incidents",
          "changeLabel": "No statistically significant change from the previous survey"
        },
        {
          "id": "theft",
          "label": "Theft",
          "value": 2600000,
          "displayValue": "2.6 million",
          "unit": "estimated incidents",
          "changeLabel": "No statistically significant change from the previous survey"
        },
        {
          "id": "otherHouseholdTheft",
          "label": "Other household theft",
          "value": 791000,
          "displayValue": "791,000",
          "unit": "estimated incidents",
          "changeLabel": "21% higher than the previous survey"
        },
        {
          "id": "fraud",
          "label": "Fraud",
          "value": 4500000,
          "displayValue": "4.5 million",
          "unit": "estimated incidents",
          "changeLabel": "No statistically significant change from the previous survey"
        },
        {
          "id": "computerMisuse",
          "label": "Computer misuse",
          "value": 798000,
          "displayValue": "798,000",
          "unit": "estimated incidents",
          "changeLabel": "No statistically significant change from the previous survey"
        },
        {
          "id": "violence",
          "label": "Violence with or without injury",
          "value": 989000,
          "displayValue": "989,000",
          "unit": "estimated incidents",
          "changeLabel": "No statistically significant change from the previous survey"
        },
        {
          "id": "criminalDamage",
          "label": "Criminal damage",
          "value": 646000,
          "displayValue": "646,000",
          "unit": "estimated incidents",
          "changeLabel": "No statistically significant change from the previous survey"
        }
      ],
      "sourceClass": "accredited-official-statistics"
    },
    "policeRecorded": {
      "status": "available",
      "title": "Crimes recorded by the police",
      "sourceLabel": "Home Office police recorded crime, published by ONS",
      "summary": "Police recorded around 5.2 million crimes excluding fraud and computer misuse, 1% fewer than the previous year.",
      "caveat": "Police-recorded crime is not the preferred measure for general crime trends because reporting, recording practices and police activity change. It is more useful for lower-volume, higher-harm offences. Recorded fraud and computer misuse are excluded while the new Report Fraud system is being introduced.",
      "measures": [
        {
          "id": "recordedCrime",
          "label": "Recorded crime excluding fraud and computer misuse",
          "value": 5200000,
          "displayValue": "5.2 million",
          "unit": "recorded offences",
          "changeLabel": "1% lower than the previous year"
        },
        {
          "id": "homicide",
          "label": "Homicide",
          "value": 499,
          "displayValue": "499",
          "unit": "recorded offences",
          "changeLabel": "7% lower than the previous year · 8.1 per million people"
        },
        {
          "id": "knife",
          "label": "Knife or sharp instrument offences",
          "value": 48774,
          "displayValue": "48,774",
          "unit": "recorded offences",
          "changeLabel": "8% lower than the previous year"
        },
        {
          "id": "firearms",
          "label": "Firearms offences",
          "value": 5151,
          "displayValue": "5,151",
          "unit": "recorded offences",
          "changeLabel": "8% lower than the previous year"
        },
        {
          "id": "personalRobbery",
          "label": "Robbery of personal property",
          "value": 57693,
          "displayValue": "57,693",
          "unit": "recorded offences",
          "changeLabel": "9% lower than the previous year"
        },
        {
          "id": "shoplifting",
          "label": "Shoplifting",
          "value": 507086,
          "displayValue": "507,086",
          "unit": "recorded offences",
          "changeLabel": "4% lower than the previous year"
        }
      ],
      "sourceClass": "official-statistics"
    },
    "justice": {
      "status": "available",
      "title": "Criminal court timeliness",
      "sourceLabel": "Ministry of Justice Criminal court statistics quarterly",
      "summary": "Median completion times increased in both magistrates’ courts and the Crown Court compared with the same quarter a year earlier.",
      "caveat": "Court timeliness measures completed defendant cases and is backwards-looking. It must not be presented as a crime rate or combined with victimisation and recorded-offence totals.",
      "measures": [
        {
          "id": "magistratesChargeToCompletion",
          "label": "Magistrates’ courts: charge to completion",
          "value": 52,
          "displayValue": "52 days",
          "unit": "median days",
          "changeLabel": "Up from 39 days a year earlier"
        },
        {
          "id": "crownChargeToCompletion",
          "label": "Crown Court: charge to completion",
          "value": 183,
          "displayValue": "183 days",
          "unit": "median days",
          "changeLabel": "Up from 180 days a year earlier"
        },
        {
          "id": "crownOffenceToCompletion",
          "label": "Crown Court: offence to completion",
          "value": 346,
          "displayValue": "346 days",
          "unit": "median days",
          "changeLabel": "Up from 326 days a year earlier"
        }
      ],
      "sourceUrl": "https://www.gov.uk/government/statistics/criminal-court-statistics-quarterly-january-to-march-2026/criminal-court-statistics-quarterly-january-to-march-2026",
      "period": "January to March 2026",
      "releaseDate": "2026-06-25"
    },
    "regional": {
      "status": "unavailable",
      "title": "Regional comparisons",
      "reason": "No regional ranking is published until one versioned Police Force Area table is joined to official geography and population inputs with reproducible rate calculations."
    },
    "evidencePolicy": {
      "combinedTotalAllowed": false,
      "modulesValidatedIndependently": true,
      "regionalRankingPublished": false
    },
    "__observation": {
      "status": "current",
      "period": "Year ending March 2026",
      "observedAt": "2026-03-31T00:00:00.000Z",
      "checkedAt": "2026-10-01T03:18:38.675Z",
      "maxAgeDays": 220
    },
    "__provenance": {
      "registryVersion": "2026-08-02.1",
      "section": "crimeStatistics",
      "title": "UK Crime Statistics",
      "evidenceClass": "official-data",
      "geography": "England and Wales",
      "retrieval": "scheduled-publication-check",
      "refreshCadence": "daily",
      "publicationCadence": "periodic",
      "operationalStatus": "active",
      "publicationRequirement": "optional",
      "upstreams": [
        {
          "publisher": "Office for National Statistics",
          "label": "Crime Survey for England and Wales (CSEW)",
          "url": "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/latest",
          "sourceClass": "official-primary"
        },
        {
          "publisher": "Home Office",
          "label": "Police Recorded Crime (PRC)",
          "url": "https://www.gov.uk/government/statistics/police-recorded-crime-open-data-tables",
          "sourceClass": "official-primary"
        },
        {
          "publisher": "Ministry of Justice",
          "label": "Criminal Court Statistics",
          "url": "https://www.gov.uk/government/collections/criminal-court-statistics",
          "sourceClass": "official-primary"
        }
      ]
    }
  },
  "electionPolling": {
    "available": true,
    "latestPublicationDate": "2026-09-28",
    "expiresAt": "2026-10-12T00:00:00.000Z",
    "polls": [
      {
        "id": "yougov-2026-09-28",
        "pollster": "YouGov",
        "commissioner": "The Times and Sky News",
        "title": "Voting intention, 27-28 September 2026: Ref 25%, Lab 24%, Con 19%, LD 12%, Grn 11%",
        "questionText": "Now, thinking specifically about your own constituency, if there were a general election held tomorrow and these were the parties standing, which party would you vote for?",
        "publicationDate": "2026-09-28",
        "fieldworkStart": "2026-09-27",
        "fieldworkEnd": "2026-09-28",
        "sampleSize": 2310,
        "geography": "Great Britain",
        "population": "GB adults",
        "mode": "Online panel",
        "headlineMethod": "Headline voting intention from constituency vote projected by YouGov's MRP model",
        "parties": {
          "conservative": 19,
          "labour": 24,
          "liberalDemocrats": 12,
          "reformUK": 25,
          "green": 11,
          "snp": 2,
          "plaidCymru": 1,
          "restoreBritain": 3,
          "other": 2
        },
        "sourceUrl": "https://ygo-assets-websites-editorial-emea.yougov.net/documents/VotingIntention_MRP_260928_w.pdf",
        "methodologyUrl": "https://yougov.com/en-gb/articles/54278-how-yougov-conducts-voting-intention-polling",
        "bpcMember": true,
        "uncertainty": "YouGov states a 9 in 10 chance that true party support lies within four points of the estimate and a 2 in 3 chance that it lies within two points."
      }
    ],
    "aggregation": {
      "method": "none",
      "explanation": "public-data.org shows each verified primary poll publication separately and does not calculate an average."
    },
    "evidencePolicy": {
      "sourceClass": "primary-pollster-publication",
      "bpcDisclosureRequired": true,
      "secondaryAggregatorsUsedAsData": false
    },
    "__observation": {
      "status": "current",
      "period": "2026-09-27/2026-09-28",
      "observedAt": "2026-09-28T00:00:00.000Z",
      "checkedAt": "2026-10-01T15:27:13.950Z",
      "maxAgeDays": 14
    }
  },
  "gdpTracker": {
    "available": true,
    "headline": {
      "period": "July 2026",
      "observedAt": 1785456000000,
      "releaseDate": "2026-09-11",
      "monthlyGrowth": 0.4,
      "threeMonthGrowth": 0.4,
      "annualGrowth": 1.6
    },
    "methodology": {
      "measure": "Real gross domestic product, seasonally adjusted",
      "status": "Official statistics",
      "revisionNote": "Monthly GDP is an early estimate and is revised as fuller source data become available."
    },
    "source": {
      "bulletinUrl": "https://www.ons.gov.uk/economy/grossdomesticproductgdp/bulletins/gdpmonthlyestimateuk/july2026",
      "landingUrl": "https://www.ons.gov.uk/economy/grossdomesticproductgdp/bulletins/gdpmonthlyestimateuk/latest"
    },
    "history": [
      {
        "period": "August 2016",
        "observedAt": 1472601600000,
        "index": 91.4,
        "monthlyGrowth": 0.2,
        "annualGrowth": 2.6,
        "threeMonthGrowth": 0.5
      },
      {
        "period": "September 2016",
        "observedAt": 1475193600000,
        "index": 91.9,
        "monthlyGrowth": 0.5,
        "annualGrowth": 3,
        "threeMonthGrowth": 0.5
      },
      {
        "period": "October 2016",
        "observedAt": 1477872000000,
        "index": 91.6,
        "monthlyGrowth": -0.3,
        "annualGrowth": 2.2,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "November 2016",
        "observedAt": 1480464000000,
        "index": 92.1,
        "monthlyGrowth": 0.4,
        "annualGrowth": 2.8,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "December 2016",
        "observedAt": 1483142400000,
        "index": 92.8,
        "monthlyGrowth": 0.8,
        "annualGrowth": 3.2,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "January 2017",
        "observedAt": 1485820800000,
        "index": 93,
        "monthlyGrowth": 0.3,
        "annualGrowth": 3.3,
        "threeMonthGrowth": 1
      },
      {
        "period": "February 2017",
        "observedAt": 1488240000000,
        "index": 93.1,
        "monthlyGrowth": 0.1,
        "annualGrowth": 2.8,
        "threeMonthGrowth": 1.1
      },
      {
        "period": "March 2017",
        "observedAt": 1490918400000,
        "index": 93.2,
        "monthlyGrowth": 0.1,
        "annualGrowth": 3.1,
        "threeMonthGrowth": 1
      },
      {
        "period": "April 2017",
        "observedAt": 1493510400000,
        "index": 93.6,
        "monthlyGrowth": 0.5,
        "annualGrowth": 2.7,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "May 2017",
        "observedAt": 1496188800000,
        "index": 93.9,
        "monthlyGrowth": 0.3,
        "annualGrowth": 3.3,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "June 2017",
        "observedAt": 1498780800000,
        "index": 94.1,
        "monthlyGrowth": 0.2,
        "annualGrowth": 3.3,
        "threeMonthGrowth": 0.9
      },
      {
        "period": "July 2017",
        "observedAt": 1501459200000,
        "index": 94.2,
        "monthlyGrowth": 0.2,
        "annualGrowth": 3.3,
        "threeMonthGrowth": 0.8
      },
      {
        "period": "August 2017",
        "observedAt": 1504137600000,
        "index": 94.4,
        "monthlyGrowth": 0.1,
        "annualGrowth": 3.2,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "September 2017",
        "observedAt": 1506729600000,
        "index": 94.8,
        "monthlyGrowth": 0.5,
        "annualGrowth": 3.1,
        "threeMonthGrowth": 0.6
      },
      {
        "period": "October 2017",
        "observedAt": 1509408000000,
        "index": 94.9,
        "monthlyGrowth": 0.1,
        "annualGrowth": 3.5,
        "threeMonthGrowth": 0.6
      },
      {
        "period": "November 2017",
        "observedAt": 1512000000000,
        "index": 95.1,
        "monthlyGrowth": 0.2,
        "annualGrowth": 3.3,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "December 2017",
        "observedAt": 1514678400000,
        "index": 95.3,
        "monthlyGrowth": 0.3,
        "annualGrowth": 2.8,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "January 2018",
        "observedAt": 1517356800000,
        "index": 95.2,
        "monthlyGrowth": -0.2,
        "annualGrowth": 2.4,
        "threeMonthGrowth": 0.5
      },
      {
        "period": "February 2018",
        "observedAt": 1519776000000,
        "index": 95.2,
        "monthlyGrowth": 0,
        "annualGrowth": 2.3,
        "threeMonthGrowth": 0.3
      },
      {
        "period": "March 2018",
        "observedAt": 1522454400000,
        "index": 95.1,
        "monthlyGrowth": -0.1,
        "annualGrowth": 2.1,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "April 2018",
        "observedAt": 1525046400000,
        "index": 95.1,
        "monthlyGrowth": 0,
        "annualGrowth": 1.6,
        "threeMonthGrowth": -0.1
      },
      {
        "period": "May 2018",
        "observedAt": 1527724800000,
        "index": 95.4,
        "monthlyGrowth": 0.3,
        "annualGrowth": 1.6,
        "threeMonthGrowth": -0.1
      },
      {
        "period": "June 2018",
        "observedAt": 1530316800000,
        "index": 95.7,
        "monthlyGrowth": 0.3,
        "annualGrowth": 1.7,
        "threeMonthGrowth": 0.2
      },
      {
        "period": "July 2018",
        "observedAt": 1532995200000,
        "index": 95.5,
        "monthlyGrowth": -0.2,
        "annualGrowth": 1.3,
        "threeMonthGrowth": 0.4
      },
      {
        "period": "August 2018",
        "observedAt": 1535673600000,
        "index": 95.8,
        "monthlyGrowth": 0.3,
        "annualGrowth": 1.5,
        "threeMonthGrowth": 0.5
      },
      {
        "period": "September 2018",
        "observedAt": 1538265600000,
        "index": 95.9,
        "monthlyGrowth": 0.1,
        "annualGrowth": 1.1,
        "threeMonthGrowth": 0.3
      },
      {
        "period": "October 2018",
        "observedAt": 1540944000000,
        "index": 95.9,
        "monthlyGrowth": 0.1,
        "annualGrowth": 1.1,
        "threeMonthGrowth": 0.3
      },
      {
        "period": "November 2018",
        "observedAt": 1543536000000,
        "index": 96,
        "monthlyGrowth": 0.1,
        "annualGrowth": 1,
        "threeMonthGrowth": 0.3
      },
      {
        "period": "December 2018",
        "observedAt": 1546214400000,
        "index": 95.5,
        "monthlyGrowth": -0.5,
        "annualGrowth": 0.2,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "January 2019",
        "observedAt": 1548892800000,
        "index": 96,
        "monthlyGrowth": 0.5,
        "annualGrowth": 0.8,
        "threeMonthGrowth": 0
      },
      {
        "period": "February 2019",
        "observedAt": 1551312000000,
        "index": 96.5,
        "monthlyGrowth": 0.6,
        "annualGrowth": 1.4,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "March 2019",
        "observedAt": 1553990400000,
        "index": 96.4,
        "monthlyGrowth": -0.2,
        "annualGrowth": 1.4,
        "threeMonthGrowth": 0.5
      },
      {
        "period": "April 2019",
        "observedAt": 1556582400000,
        "index": 96,
        "monthlyGrowth": -0.4,
        "annualGrowth": 1,
        "threeMonthGrowth": 0.5
      },
      {
        "period": "May 2019",
        "observedAt": 1559260800000,
        "index": 96.5,
        "monthlyGrowth": 0.5,
        "annualGrowth": 1.2,
        "threeMonthGrowth": 0.3
      },
      {
        "period": "June 2019",
        "observedAt": 1561852800000,
        "index": 97.1,
        "monthlyGrowth": 0.6,
        "annualGrowth": 1.5,
        "threeMonthGrowth": 0.2
      },
      {
        "period": "July 2019",
        "observedAt": 1564531200000,
        "index": 97.2,
        "monthlyGrowth": 0.1,
        "annualGrowth": 1.8,
        "threeMonthGrowth": 0.6
      },
      {
        "period": "August 2019",
        "observedAt": 1567209600000,
        "index": 97,
        "monthlyGrowth": -0.2,
        "annualGrowth": 1.3,
        "threeMonthGrowth": 0.8
      },
      {
        "period": "September 2019",
        "observedAt": 1569801600000,
        "index": 97.4,
        "monthlyGrowth": 0.4,
        "annualGrowth": 1.6,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "October 2019",
        "observedAt": 1572480000000,
        "index": 97.3,
        "monthlyGrowth": -0.1,
        "annualGrowth": 1.4,
        "threeMonthGrowth": 0.3
      },
      {
        "period": "November 2019",
        "observedAt": 1575072000000,
        "index": 97,
        "monthlyGrowth": -0.3,
        "annualGrowth": 1,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "December 2019",
        "observedAt": 1577750400000,
        "index": 97.4,
        "monthlyGrowth": 0.4,
        "annualGrowth": 1.9,
        "threeMonthGrowth": 0
      },
      {
        "period": "January 2020",
        "observedAt": 1580428800000,
        "index": 97.3,
        "monthlyGrowth": -0.1,
        "annualGrowth": 1.3,
        "threeMonthGrowth": 0
      },
      {
        "period": "February 2020",
        "observedAt": 1582934400000,
        "index": 97.3,
        "monthlyGrowth": 0,
        "annualGrowth": 0.8,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "March 2020",
        "observedAt": 1585612800000,
        "index": 89.9,
        "monthlyGrowth": -7.6,
        "annualGrowth": -6.7,
        "threeMonthGrowth": -2.5
      },
      {
        "period": "April 2020",
        "observedAt": 1588204800000,
        "index": 72.7,
        "monthlyGrowth": -19.2,
        "annualGrowth": -24.3,
        "threeMonthGrowth": -10.9
      },
      {
        "period": "May 2020",
        "observedAt": 1590883200000,
        "index": 74.2,
        "monthlyGrowth": 2.1,
        "annualGrowth": -23.1,
        "threeMonthGrowth": -18.9
      },
      {
        "period": "June 2020",
        "observedAt": 1593475200000,
        "index": 81.1,
        "monthlyGrowth": 9.3,
        "annualGrowth": -16.5,
        "threeMonthGrowth": -19.9
      },
      {
        "period": "July 2020",
        "observedAt": 1596153600000,
        "index": 86.6,
        "monthlyGrowth": 6.7,
        "annualGrowth": -10.9,
        "threeMonthGrowth": -6.9
      },
      {
        "period": "August 2020",
        "observedAt": 1598832000000,
        "index": 89.6,
        "monthlyGrowth": 3.5,
        "annualGrowth": -7.6,
        "threeMonthGrowth": 8.7
      },
      {
        "period": "September 2020",
        "observedAt": 1601424000000,
        "index": 90.8,
        "monthlyGrowth": 1.4,
        "annualGrowth": -6.7,
        "threeMonthGrowth": 17.1
      },
      {
        "period": "October 2020",
        "observedAt": 1604102400000,
        "index": 91.2,
        "monthlyGrowth": 0.3,
        "annualGrowth": -6.3,
        "threeMonthGrowth": 12.3
      },
      {
        "period": "November 2020",
        "observedAt": 1606694400000,
        "index": 89.2,
        "monthlyGrowth": -2.1,
        "annualGrowth": -8,
        "threeMonthGrowth": 5.4
      },
      {
        "period": "December 2020",
        "observedAt": 1609372800000,
        "index": 90.8,
        "monthlyGrowth": 1.7,
        "annualGrowth": -6.8,
        "threeMonthGrowth": 1.5
      },
      {
        "period": "January 2021",
        "observedAt": 1612051200000,
        "index": 87.8,
        "monthlyGrowth": -3.2,
        "annualGrowth": -9.7,
        "threeMonthGrowth": -1.4
      },
      {
        "period": "February 2021",
        "observedAt": 1614470400000,
        "index": 88.9,
        "monthlyGrowth": 1.2,
        "annualGrowth": -8.6,
        "threeMonthGrowth": -1.4
      },
      {
        "period": "March 2021",
        "observedAt": 1617148800000,
        "index": 91.5,
        "monthlyGrowth": 2.9,
        "annualGrowth": 1.8,
        "threeMonthGrowth": -1.1
      },
      {
        "period": "April 2021",
        "observedAt": 1619740800000,
        "index": 94.5,
        "monthlyGrowth": 3.2,
        "annualGrowth": 30,
        "threeMonthGrowth": 2.6
      },
      {
        "period": "May 2021",
        "observedAt": 1622419200000,
        "index": 95.8,
        "monthlyGrowth": 1.4,
        "annualGrowth": 29.1,
        "threeMonthGrowth": 5.3
      },
      {
        "period": "June 2021",
        "observedAt": 1625011200000,
        "index": 96.7,
        "monthlyGrowth": 1,
        "annualGrowth": 19.2,
        "threeMonthGrowth": 7
      },
      {
        "period": "July 2021",
        "observedAt": 1627689600000,
        "index": 96.3,
        "monthlyGrowth": -0.4,
        "annualGrowth": 11.3,
        "threeMonthGrowth": 5.1
      },
      {
        "period": "August 2021",
        "observedAt": 1630368000000,
        "index": 97.3,
        "monthlyGrowth": 1,
        "annualGrowth": 8.5,
        "threeMonthGrowth": 3
      },
      {
        "period": "September 2021",
        "observedAt": 1632960000000,
        "index": 97.8,
        "monthlyGrowth": 0.6,
        "annualGrowth": 7.7,
        "threeMonthGrowth": 1.6
      },
      {
        "period": "October 2021",
        "observedAt": 1635638400000,
        "index": 98,
        "monthlyGrowth": 0.1,
        "annualGrowth": 7.5,
        "threeMonthGrowth": 1.5
      },
      {
        "period": "November 2021",
        "observedAt": 1638230400000,
        "index": 98.5,
        "monthlyGrowth": 0.5,
        "annualGrowth": 10.4,
        "threeMonthGrowth": 1.4
      },
      {
        "period": "December 2021",
        "observedAt": 1640908800000,
        "index": 98.3,
        "monthlyGrowth": -0.2,
        "annualGrowth": 8.3,
        "threeMonthGrowth": 1.2
      },
      {
        "period": "January 2022",
        "observedAt": 1643587200000,
        "index": 98.9,
        "monthlyGrowth": 0.6,
        "annualGrowth": 12.6,
        "threeMonthGrowth": 0.9
      },
      {
        "period": "February 2022",
        "observedAt": 1646006400000,
        "index": 99.3,
        "monthlyGrowth": 0.4,
        "annualGrowth": 11.7,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "March 2022",
        "observedAt": 1648684800000,
        "index": 99.3,
        "monthlyGrowth": 0,
        "annualGrowth": 8.5,
        "threeMonthGrowth": 0.9
      },
      {
        "period": "April 2022",
        "observedAt": 1651276800000,
        "index": 99.5,
        "monthlyGrowth": 0.2,
        "annualGrowth": 5.4,
        "threeMonthGrowth": 0.8
      },
      {
        "period": "May 2022",
        "observedAt": 1653955200000,
        "index": 100,
        "monthlyGrowth": 0.5,
        "annualGrowth": 4.4,
        "threeMonthGrowth": 0.8
      },
      {
        "period": "June 2022",
        "observedAt": 1656547200000,
        "index": 99.4,
        "monthlyGrowth": -0.7,
        "annualGrowth": 2.8,
        "threeMonthGrowth": 0.5
      },
      {
        "period": "July 2022",
        "observedAt": 1659225600000,
        "index": 99.9,
        "monthlyGrowth": 0.5,
        "annualGrowth": 3.7,
        "threeMonthGrowth": 0.4
      },
      {
        "period": "August 2022",
        "observedAt": 1661904000000,
        "index": 99.9,
        "monthlyGrowth": 0,
        "annualGrowth": 2.7,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "September 2022",
        "observedAt": 1664496000000,
        "index": 99.2,
        "monthlyGrowth": -0.7,
        "annualGrowth": 1.4,
        "threeMonthGrowth": 0
      },
      {
        "period": "October 2022",
        "observedAt": 1667174400000,
        "index": 100.1,
        "monthlyGrowth": 1,
        "annualGrowth": 2.2,
        "threeMonthGrowth": 0
      },
      {
        "period": "November 2022",
        "observedAt": 1669766400000,
        "index": 100.2,
        "monthlyGrowth": 0.1,
        "annualGrowth": 1.7,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "December 2022",
        "observedAt": 1672444800000,
        "index": 99.7,
        "monthlyGrowth": -0.5,
        "annualGrowth": 1.4,
        "threeMonthGrowth": 0.4
      },
      {
        "period": "January 2023",
        "observedAt": 1675123200000,
        "index": 100.1,
        "monthlyGrowth": 0.4,
        "annualGrowth": 1.2,
        "threeMonthGrowth": 0.3
      },
      {
        "period": "February 2023",
        "observedAt": 1677542400000,
        "index": 100.3,
        "monthlyGrowth": 0.2,
        "annualGrowth": 1,
        "threeMonthGrowth": 0.2
      },
      {
        "period": "March 2023",
        "observedAt": 1680220800000,
        "index": 99.9,
        "monthlyGrowth": -0.4,
        "annualGrowth": 0.6,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "April 2023",
        "observedAt": 1682812800000,
        "index": 100.1,
        "monthlyGrowth": 0.2,
        "annualGrowth": 0.6,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "May 2023",
        "observedAt": 1685491200000,
        "index": 99.8,
        "monthlyGrowth": -0.3,
        "annualGrowth": -0.2,
        "threeMonthGrowth": -0.1
      },
      {
        "period": "June 2023",
        "observedAt": 1688083200000,
        "index": 100.5,
        "monthlyGrowth": 0.6,
        "annualGrowth": 1.1,
        "threeMonthGrowth": 0
      },
      {
        "period": "July 2023",
        "observedAt": 1690761600000,
        "index": 100.1,
        "monthlyGrowth": -0.4,
        "annualGrowth": 0.2,
        "threeMonthGrowth": 0
      },
      {
        "period": "August 2023",
        "observedAt": 1693440000000,
        "index": 100,
        "monthlyGrowth": -0.1,
        "annualGrowth": 0.1,
        "threeMonthGrowth": 0.2
      },
      {
        "period": "September 2023",
        "observedAt": 1696032000000,
        "index": 100,
        "monthlyGrowth": 0,
        "annualGrowth": 0.8,
        "threeMonthGrowth": -0.1
      },
      {
        "period": "October 2023",
        "observedAt": 1698710400000,
        "index": 99.6,
        "monthlyGrowth": -0.4,
        "annualGrowth": -0.5,
        "threeMonthGrowth": -0.3
      },
      {
        "period": "November 2023",
        "observedAt": 1701302400000,
        "index": 99.9,
        "monthlyGrowth": 0.3,
        "annualGrowth": -0.3,
        "threeMonthGrowth": -0.4
      },
      {
        "period": "December 2023",
        "observedAt": 1703980800000,
        "index": 99.6,
        "monthlyGrowth": -0.3,
        "annualGrowth": -0.1,
        "threeMonthGrowth": -0.3
      },
      {
        "period": "January 2024",
        "observedAt": 1706659200000,
        "index": 100.1,
        "monthlyGrowth": 0.5,
        "annualGrowth": 0,
        "threeMonthGrowth": 0
      },
      {
        "period": "February 2024",
        "observedAt": 1709164800000,
        "index": 100.3,
        "monthlyGrowth": 0.2,
        "annualGrowth": 0,
        "threeMonthGrowth": 0.2
      },
      {
        "period": "March 2024",
        "observedAt": 1711843200000,
        "index": 100.6,
        "monthlyGrowth": 0.3,
        "annualGrowth": 0.7,
        "threeMonthGrowth": 0.6
      },
      {
        "period": "April 2024",
        "observedAt": 1714435200000,
        "index": 100.7,
        "monthlyGrowth": 0.1,
        "annualGrowth": 0.6,
        "threeMonthGrowth": 0.7
      },
      {
        "period": "May 2024",
        "observedAt": 1717113600000,
        "index": 101.1,
        "monthlyGrowth": 0.3,
        "annualGrowth": 1.2,
        "threeMonthGrowth": 0.8
      },
      {
        "period": "June 2024",
        "observedAt": 1719705600000,
        "index": 100.8,
        "monthlyGrowth": -0.2,
        "annualGrowth": 0.4,
        "threeMonthGrowth": 0.5
      },
      {
        "period": "July 2024",
        "observedAt": 1722384000000,
        "index": 100.8,
        "monthlyGrowth": 0,
        "annualGrowth": 0.7,
        "threeMonthGrowth": 0.3
      },
      {
        "period": "August 2024",
        "observedAt": 1725062400000,
        "index": 101.1,
        "monthlyGrowth": 0.3,
        "annualGrowth": 1.1,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "September 2024",
        "observedAt": 1727654400000,
        "index": 101,
        "monthlyGrowth": 0,
        "annualGrowth": 1,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "October 2024",
        "observedAt": 1730332800000,
        "index": 101.1,
        "monthlyGrowth": 0.1,
        "annualGrowth": 1.5,
        "threeMonthGrowth": 0.2
      },
      {
        "period": "November 2024",
        "observedAt": 1732924800000,
        "index": 101.2,
        "monthlyGrowth": 0.1,
        "annualGrowth": 1.3,
        "threeMonthGrowth": 0.2
      },
      {
        "period": "December 2024",
        "observedAt": 1735603200000,
        "index": 101.6,
        "monthlyGrowth": 0.4,
        "annualGrowth": 2,
        "threeMonthGrowth": 0.4
      },
      {
        "period": "January 2025",
        "observedAt": 1738281600000,
        "index": 101.6,
        "monthlyGrowth": 0,
        "annualGrowth": 1.5,
        "threeMonthGrowth": 0.4
      },
      {
        "period": "February 2025",
        "observedAt": 1740700800000,
        "index": 101.9,
        "monthlyGrowth": 0.3,
        "annualGrowth": 1.6,
        "threeMonthGrowth": 0.6
      },
      {
        "period": "March 2025",
        "observedAt": 1743379200000,
        "index": 102.1,
        "monthlyGrowth": 0.2,
        "annualGrowth": 1.5,
        "threeMonthGrowth": 0.6
      },
      {
        "period": "April 2025",
        "observedAt": 1745971200000,
        "index": 102,
        "monthlyGrowth": -0.1,
        "annualGrowth": 1.2,
        "threeMonthGrowth": 0.5
      },
      {
        "period": "May 2025",
        "observedAt": 1748649600000,
        "index": 101.9,
        "monthlyGrowth": -0.1,
        "annualGrowth": 0.8,
        "threeMonthGrowth": 0.2
      },
      {
        "period": "June 2025",
        "observedAt": 1751241600000,
        "index": 102.3,
        "monthlyGrowth": 0.4,
        "annualGrowth": 1.5,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "July 2025",
        "observedAt": 1753920000000,
        "index": 102.2,
        "monthlyGrowth": -0.1,
        "annualGrowth": 1.4,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "August 2025",
        "observedAt": 1756598400000,
        "index": 102,
        "monthlyGrowth": -0.3,
        "annualGrowth": 0.9,
        "threeMonthGrowth": 0.2
      },
      {
        "period": "September 2025",
        "observedAt": 1759190400000,
        "index": 102,
        "monthlyGrowth": 0.1,
        "annualGrowth": 1,
        "threeMonthGrowth": 0
      },
      {
        "period": "October 2025",
        "observedAt": 1761868800000,
        "index": 102,
        "monthlyGrowth": -0.1,
        "annualGrowth": 0.8,
        "threeMonthGrowth": -0.1
      },
      {
        "period": "November 2025",
        "observedAt": 1764460800000,
        "index": 102.1,
        "monthlyGrowth": 0.1,
        "annualGrowth": 0.9,
        "threeMonthGrowth": -0.1
      },
      {
        "period": "December 2025",
        "observedAt": 1767139200000,
        "index": 102.3,
        "monthlyGrowth": 0.2,
        "annualGrowth": 0.7,
        "threeMonthGrowth": 0.1
      },
      {
        "period": "January 2026",
        "observedAt": 1769817600000,
        "index": 102.3,
        "monthlyGrowth": 0,
        "annualGrowth": 0.7,
        "threeMonthGrowth": 0.3
      },
      {
        "period": "February 2026",
        "observedAt": 1772236800000,
        "index": 102.8,
        "monthlyGrowth": 0.5,
        "annualGrowth": 0.8,
        "threeMonthGrowth": 0.4
      },
      {
        "period": "March 2026",
        "observedAt": 1774915200000,
        "index": 103.2,
        "monthlyGrowth": 0.3,
        "annualGrowth": 1,
        "threeMonthGrowth": 0.6
      },
      {
        "period": "April 2026",
        "observedAt": 1777507200000,
        "index": 103.1,
        "monthlyGrowth": -0.1,
        "annualGrowth": 1.1,
        "threeMonthGrowth": 0.8
      },
      {
        "period": "May 2026",
        "observedAt": 1780185600000,
        "index": 103.1,
        "monthlyGrowth": 0,
        "annualGrowth": 1.2,
        "threeMonthGrowth": 0.6
      },
      {
        "period": "June 2026",
        "observedAt": 1782777600000,
        "index": 103.4,
        "monthlyGrowth": 0.3,
        "annualGrowth": 1.1,
        "threeMonthGrowth": 0.4
      },
      {
        "period": "July 2026",
        "observedAt": 1785456000000,
        "index": 103.8,
        "monthlyGrowth": 0.4,
        "annualGrowth": 1.6,
        "threeMonthGrowth": 0.4
      }
    ],
    "series": {
      "index": {
        "id": "ECY2",
        "url": "https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/ecy2/mgdp"
      },
      "monthlyGrowth": {
        "id": "ECYX",
        "url": "https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/ecyx/mgdp"
      },
      "annualGrowth": {
        "id": "ED2R",
        "url": "https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/ed2r/mgdp"
      },
      "threeMonthGrowth": {
        "id": "ED3H",
        "url": "https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/ed3h/mgdp"
      }
    },
    "expiresAt": "2026-11-20T00:00:00.000Z",
    "__observation": {
      "status": "current",
      "period": "July 2026",
      "observedAt": "2026-07-31T00:00:00.000Z",
      "checkedAt": "2026-10-01T15:26:05.938Z",
      "maxAgeDays": 70
    },
    "__provenance": {
      "registryVersion": "2026-08-02.1",
      "section": "gdpTracker",
      "title": "Monthly gross domestic product",
      "evidenceClass": "official-data",
      "geography": "United Kingdom",
      "retrieval": "scheduled-publication-check",
      "refreshCadence": "daily",
      "publicationCadence": "monthly",
      "operationalStatus": "active",
      "publicationRequirement": "required",
      "upstreams": [
        {
          "publisher": "Office for National Statistics",
          "label": "GDP monthly estimate, UK bulletin",
          "url": "https://www.ons.gov.uk/economy/grossdomesticproductgdp/bulletins/gdpmonthlyestimateuk/latest",
          "sourceClass": "official-primary",
          "caveat": "The Worker discovers and validates the latest bulletin edition from this rolling publication page."
        }
      ]
    }
  },
  "employmentStats": {
    "available": true,
    "headline": {
      "period": "May to July 2026",
      "observedAt": 1785456000000,
      "releaseDate": "2026-09-15",
      "employmentRate": 75.1,
      "unemploymentRate": 4.9,
      "inactivityRate": 20.9,
      "vacancies": 702000,
      "vacanciesPeriod": "June to August 2026"
    },
    "methodology": {
      "status": "Official statistics",
      "caveat": "Labour Force Survey rates use rolling three-month periods and carry sampling uncertainty. Vacancy estimates use a separate business survey and have their own rolling period."
    },
    "source": {
      "bulletinUrl": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/september2026",
      "landingUrl": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/latest"
    },
    "annualDelta": {
      "employmentRatePoints": -0.1,
      "unemploymentRatePoints": 0.2,
      "inactivityRatePoints": -0.1,
      "vacancies": -36000
    },
    "history": {
      "labourForce": [
        {
          "period": "2016 JUN-AUG",
          "observedAt": 1472601600000,
          "employmentRate": 74.4,
          "unemploymentRate": 5,
          "inactivityRate": 21.6
        },
        {
          "period": "2016 JUL-SEP",
          "observedAt": 1475193600000,
          "employmentRate": 74.4,
          "unemploymentRate": 4.8,
          "inactivityRate": 21.7
        },
        {
          "period": "2016 AUG-OCT",
          "observedAt": 1477872000000,
          "employmentRate": 74.4,
          "unemploymentRate": 4.8,
          "inactivityRate": 21.7
        },
        {
          "period": "2016 SEP-NOV",
          "observedAt": 1480464000000,
          "employmentRate": 74.4,
          "unemploymentRate": 4.8,
          "inactivityRate": 21.8
        },
        {
          "period": "2016 OCT-DEC",
          "observedAt": 1483142400000,
          "employmentRate": 74.5,
          "unemploymentRate": 4.7,
          "inactivityRate": 21.7
        },
        {
          "period": "2017 NOV-JAN",
          "observedAt": 1485820800000,
          "employmentRate": 74.5,
          "unemploymentRate": 4.7,
          "inactivityRate": 21.7
        },
        {
          "period": "2017 DEC-FEB",
          "observedAt": 1488240000000,
          "employmentRate": 74.6,
          "unemploymentRate": 4.6,
          "inactivityRate": 21.7
        },
        {
          "period": "2017 JAN-MAR",
          "observedAt": 1490918400000,
          "employmentRate": 74.7,
          "unemploymentRate": 4.6,
          "inactivityRate": 21.6
        },
        {
          "period": "2017 FEB-APR",
          "observedAt": 1493510400000,
          "employmentRate": 74.7,
          "unemploymentRate": 4.5,
          "inactivityRate": 21.6
        },
        {
          "period": "2017 MAR-MAY",
          "observedAt": 1496188800000,
          "employmentRate": 74.8,
          "unemploymentRate": 4.4,
          "inactivityRate": 21.6
        },
        {
          "period": "2017 APR-JUN",
          "observedAt": 1498780800000,
          "employmentRate": 75,
          "unemploymentRate": 4.4,
          "inactivityRate": 21.4
        },
        {
          "period": "2017 MAY-JUL",
          "observedAt": 1501459200000,
          "employmentRate": 75.2,
          "unemploymentRate": 4.3,
          "inactivityRate": 21.3
        },
        {
          "period": "2017 JUN-AUG",
          "observedAt": 1504137600000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.3,
          "inactivityRate": 21.5
        },
        {
          "period": "2017 JUL-SEP",
          "observedAt": 1506729600000,
          "employmentRate": 74.9,
          "unemploymentRate": 4.3,
          "inactivityRate": 21.7
        },
        {
          "period": "2017 AUG-OCT",
          "observedAt": 1509408000000,
          "employmentRate": 75,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.6
        },
        {
          "period": "2017 SEP-NOV",
          "observedAt": 1512000000000,
          "employmentRate": 75.2,
          "unemploymentRate": 4.3,
          "inactivityRate": 21.3
        },
        {
          "period": "2017 OCT-DEC",
          "observedAt": 1514678400000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.4,
          "inactivityRate": 21.4
        },
        {
          "period": "2018 NOV-JAN",
          "observedAt": 1517356800000,
          "employmentRate": 75.2,
          "unemploymentRate": 4.3,
          "inactivityRate": 21.3
        },
        {
          "period": "2018 DEC-FEB",
          "observedAt": 1519776000000,
          "employmentRate": 75.3,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.3
        },
        {
          "period": "2018 JAN-MAR",
          "observedAt": 1522454400000,
          "employmentRate": 75.5,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.2
        },
        {
          "period": "2018 FEB-APR",
          "observedAt": 1525046400000,
          "employmentRate": 75.5,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.1
        },
        {
          "period": "2018 MAR-MAY",
          "observedAt": 1527724800000,
          "employmentRate": 75.5,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.1
        },
        {
          "period": "2018 APR-JUN",
          "observedAt": 1530316800000,
          "employmentRate": 75.4,
          "unemploymentRate": 4,
          "inactivityRate": 21.3
        },
        {
          "period": "2018 MAY-JUL",
          "observedAt": 1532995200000,
          "employmentRate": 75.4,
          "unemploymentRate": 4,
          "inactivityRate": 21.4
        },
        {
          "period": "2018 JUN-AUG",
          "observedAt": 1535673600000,
          "employmentRate": 75.4,
          "unemploymentRate": 4,
          "inactivityRate": 21.3
        },
        {
          "period": "2018 JUL-SEP",
          "observedAt": 1538265600000,
          "employmentRate": 75.4,
          "unemploymentRate": 4.1,
          "inactivityRate": 21.3
        },
        {
          "period": "2018 AUG-OCT",
          "observedAt": 1540944000000,
          "employmentRate": 75.6,
          "unemploymentRate": 4.1,
          "inactivityRate": 21.1
        },
        {
          "period": "2018 SEP-NOV",
          "observedAt": 1543536000000,
          "employmentRate": 75.6,
          "unemploymentRate": 4,
          "inactivityRate": 21.1
        },
        {
          "period": "2018 OCT-DEC",
          "observedAt": 1546214400000,
          "employmentRate": 75.7,
          "unemploymentRate": 4,
          "inactivityRate": 21.1
        },
        {
          "period": "2019 NOV-JAN",
          "observedAt": 1548892800000,
          "employmentRate": 76,
          "unemploymentRate": 3.9,
          "inactivityRate": 20.9
        },
        {
          "period": "2019 DEC-FEB",
          "observedAt": 1551312000000,
          "employmentRate": 76,
          "unemploymentRate": 4,
          "inactivityRate": 20.8
        },
        {
          "period": "2019 JAN-MAR",
          "observedAt": 1553990400000,
          "employmentRate": 75.9,
          "unemploymentRate": 3.8,
          "inactivityRate": 21
        },
        {
          "period": "2019 FEB-APR",
          "observedAt": 1556582400000,
          "employmentRate": 76,
          "unemploymentRate": 3.8,
          "inactivityRate": 20.9
        },
        {
          "period": "2019 MAR-MAY",
          "observedAt": 1559260800000,
          "employmentRate": 76,
          "unemploymentRate": 3.8,
          "inactivityRate": 20.9
        },
        {
          "period": "2019 APR-JUN",
          "observedAt": 1561852800000,
          "employmentRate": 76.1,
          "unemploymentRate": 3.9,
          "inactivityRate": 20.7
        },
        {
          "period": "2019 MAY-JUL",
          "observedAt": 1564531200000,
          "employmentRate": 76,
          "unemploymentRate": 3.9,
          "inactivityRate": 20.8
        },
        {
          "period": "2019 JUN-AUG",
          "observedAt": 1567209600000,
          "employmentRate": 75.9,
          "unemploymentRate": 3.9,
          "inactivityRate": 20.9
        },
        {
          "period": "2019 JUL-SEP",
          "observedAt": 1569801600000,
          "employmentRate": 76,
          "unemploymentRate": 3.9,
          "inactivityRate": 20.8
        },
        {
          "period": "2019 AUG-OCT",
          "observedAt": 1572480000000,
          "employmentRate": 76,
          "unemploymentRate": 3.8,
          "inactivityRate": 20.9
        },
        {
          "period": "2019 SEP-NOV",
          "observedAt": 1575072000000,
          "employmentRate": 76.2,
          "unemploymentRate": 3.8,
          "inactivityRate": 20.7
        },
        {
          "period": "2019 OCT-DEC",
          "observedAt": 1577750400000,
          "employmentRate": 76.4,
          "unemploymentRate": 3.7,
          "inactivityRate": 20.6
        },
        {
          "period": "2020 NOV-JAN",
          "observedAt": 1580428800000,
          "employmentRate": 76.4,
          "unemploymentRate": 3.9,
          "inactivityRate": 20.5
        },
        {
          "period": "2020 DEC-FEB",
          "observedAt": 1582934400000,
          "employmentRate": 76.5,
          "unemploymentRate": 3.9,
          "inactivityRate": 20.3
        },
        {
          "period": "2020 JAN-MAR",
          "observedAt": 1585612800000,
          "employmentRate": 75.9,
          "unemploymentRate": 4.1,
          "inactivityRate": 20.7
        },
        {
          "period": "2020 FEB-APR",
          "observedAt": 1588204800000,
          "employmentRate": 75.7,
          "unemploymentRate": 4.1,
          "inactivityRate": 21
        },
        {
          "period": "2020 MAR-MAY",
          "observedAt": 1590883200000,
          "employmentRate": 75.5,
          "unemploymentRate": 4.1,
          "inactivityRate": 21.2
        },
        {
          "period": "2020 APR-JUN",
          "observedAt": 1593475200000,
          "employmentRate": 75.4,
          "unemploymentRate": 4.1,
          "inactivityRate": 21.3
        },
        {
          "period": "2020 MAY-JUL",
          "observedAt": 1596153600000,
          "employmentRate": 75.2,
          "unemploymentRate": 4.4,
          "inactivityRate": 21.2
        },
        {
          "period": "2020 JUN-AUG",
          "observedAt": 1598832000000,
          "employmentRate": 75,
          "unemploymentRate": 4.6,
          "inactivityRate": 21.3
        },
        {
          "period": "2020 JUL-SEP",
          "observedAt": 1601424000000,
          "employmentRate": 74.6,
          "unemploymentRate": 5,
          "inactivityRate": 21.4
        },
        {
          "period": "2020 AUG-OCT",
          "observedAt": 1604102400000,
          "employmentRate": 74.5,
          "unemploymentRate": 5.2,
          "inactivityRate": 21.4
        },
        {
          "period": "2020 SEP-NOV",
          "observedAt": 1606694400000,
          "employmentRate": 74.5,
          "unemploymentRate": 5.2,
          "inactivityRate": 21.3
        },
        {
          "period": "2020 OCT-DEC",
          "observedAt": 1609372800000,
          "employmentRate": 74.3,
          "unemploymentRate": 5.3,
          "inactivityRate": 21.5
        },
        {
          "period": "2021 NOV-JAN",
          "observedAt": 1612051200000,
          "employmentRate": 74.3,
          "unemploymentRate": 5.2,
          "inactivityRate": 21.5
        },
        {
          "period": "2021 DEC-FEB",
          "observedAt": 1614470400000,
          "employmentRate": 74.5,
          "unemploymentRate": 5,
          "inactivityRate": 21.5
        },
        {
          "period": "2021 JAN-MAR",
          "observedAt": 1617148800000,
          "employmentRate": 74.4,
          "unemploymentRate": 4.9,
          "inactivityRate": 21.6
        },
        {
          "period": "2021 FEB-APR",
          "observedAt": 1619740800000,
          "employmentRate": 74.4,
          "unemploymentRate": 4.8,
          "inactivityRate": 21.7
        },
        {
          "period": "2021 MAR-MAY",
          "observedAt": 1622419200000,
          "employmentRate": 74.4,
          "unemploymentRate": 4.8,
          "inactivityRate": 21.7
        },
        {
          "period": "2021 APR-JUN",
          "observedAt": 1625011200000,
          "employmentRate": 74.7,
          "unemploymentRate": 4.7,
          "inactivityRate": 21.6
        },
        {
          "period": "2021 MAY-JUL",
          "observedAt": 1627689600000,
          "employmentRate": 74.8,
          "unemploymentRate": 4.6,
          "inactivityRate": 21.5
        },
        {
          "period": "2021 JUN-AUG",
          "observedAt": 1630368000000,
          "employmentRate": 74.9,
          "unemploymentRate": 4.5,
          "inactivityRate": 21.5
        },
        {
          "period": "2021 JUL-SEP",
          "observedAt": 1632960000000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.4,
          "inactivityRate": 21.4
        },
        {
          "period": "2021 AUG-OCT",
          "observedAt": 1635638400000,
          "employmentRate": 75,
          "unemploymentRate": 4.3,
          "inactivityRate": 21.6
        },
        {
          "period": "2021 SEP-NOV",
          "observedAt": 1638230400000,
          "employmentRate": 75,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.6
        },
        {
          "period": "2021 OCT-DEC",
          "observedAt": 1640908800000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.6
        },
        {
          "period": "2022 NOV-JAN",
          "observedAt": 1643587200000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.1,
          "inactivityRate": 21.7
        },
        {
          "period": "2022 DEC-FEB",
          "observedAt": 1646006400000,
          "employmentRate": 75,
          "unemploymentRate": 3.9,
          "inactivityRate": 21.8
        },
        {
          "period": "2022 JAN-MAR",
          "observedAt": 1648684800000,
          "employmentRate": 75.1,
          "unemploymentRate": 3.8,
          "inactivityRate": 21.9
        },
        {
          "period": "2022 FEB-APR",
          "observedAt": 1651276800000,
          "employmentRate": 75.2,
          "unemploymentRate": 3.8,
          "inactivityRate": 21.8
        },
        {
          "period": "2022 MAR-MAY",
          "observedAt": 1653955200000,
          "employmentRate": 75.4,
          "unemploymentRate": 3.7,
          "inactivityRate": 21.7
        },
        {
          "period": "2022 APR-JUN",
          "observedAt": 1656547200000,
          "employmentRate": 75,
          "unemploymentRate": 3.8,
          "inactivityRate": 21.9
        },
        {
          "period": "2022 MAY-JUL",
          "observedAt": 1659225600000,
          "employmentRate": 74.9,
          "unemploymentRate": 3.6,
          "inactivityRate": 22.2
        },
        {
          "period": "2022 JUN-AUG",
          "observedAt": 1661904000000,
          "employmentRate": 75,
          "unemploymentRate": 3.6,
          "inactivityRate": 22.1
        },
        {
          "period": "2022 JUL-SEP",
          "observedAt": 1664496000000,
          "employmentRate": 75,
          "unemploymentRate": 3.7,
          "inactivityRate": 22.1
        },
        {
          "period": "2022 AUG-OCT",
          "observedAt": 1667174400000,
          "employmentRate": 75,
          "unemploymentRate": 3.8,
          "inactivityRate": 21.9
        },
        {
          "period": "2022 SEP-NOV",
          "observedAt": 1669766400000,
          "employmentRate": 75,
          "unemploymentRate": 3.9,
          "inactivityRate": 21.9
        },
        {
          "period": "2022 OCT-DEC",
          "observedAt": 1672444800000,
          "employmentRate": 75.1,
          "unemploymentRate": 3.9,
          "inactivityRate": 21.7
        },
        {
          "period": "2023 NOV-JAN",
          "observedAt": 1675123200000,
          "employmentRate": 75.2,
          "unemploymentRate": 3.9,
          "inactivityRate": 21.7
        },
        {
          "period": "2023 DEC-FEB",
          "observedAt": 1677542400000,
          "employmentRate": 75.1,
          "unemploymentRate": 4,
          "inactivityRate": 21.7
        },
        {
          "period": "2023 JAN-MAR",
          "observedAt": 1680220800000,
          "employmentRate": 75.3,
          "unemploymentRate": 4,
          "inactivityRate": 21.5
        },
        {
          "period": "2023 FEB-APR",
          "observedAt": 1682812800000,
          "employmentRate": 75.5,
          "unemploymentRate": 3.9,
          "inactivityRate": 21.4
        },
        {
          "period": "2023 MAR-MAY",
          "observedAt": 1685491200000,
          "employmentRate": 75.4,
          "unemploymentRate": 4,
          "inactivityRate": 21.4
        },
        {
          "period": "2023 APR-JUN",
          "observedAt": 1688083200000,
          "employmentRate": 75.2,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.4
        },
        {
          "period": "2023 MAY-JUL",
          "observedAt": 1690761600000,
          "employmentRate": 74.9,
          "unemploymentRate": 4.4,
          "inactivityRate": 21.6
        },
        {
          "period": "2023 JUN-AUG",
          "observedAt": 1693440000000,
          "employmentRate": 74.7,
          "unemploymentRate": 4.3,
          "inactivityRate": 21.9
        },
        {
          "period": "2023 JUL-SEP",
          "observedAt": 1696032000000,
          "employmentRate": 74.9,
          "unemploymentRate": 4.1,
          "inactivityRate": 21.8
        },
        {
          "period": "2023 AUG-OCT",
          "observedAt": 1698710400000,
          "employmentRate": 74.9,
          "unemploymentRate": 4,
          "inactivityRate": 21.9
        },
        {
          "period": "2023 SEP-NOV",
          "observedAt": 1701302400000,
          "employmentRate": 74.9,
          "unemploymentRate": 4,
          "inactivityRate": 22
        },
        {
          "period": "2023 OCT-DEC",
          "observedAt": 1703980800000,
          "employmentRate": 74.9,
          "unemploymentRate": 3.9,
          "inactivityRate": 22
        },
        {
          "period": "2024 NOV-JAN",
          "observedAt": 1706659200000,
          "employmentRate": 74.7,
          "unemploymentRate": 4.1,
          "inactivityRate": 22
        },
        {
          "period": "2024 DEC-FEB",
          "observedAt": 1709164800000,
          "employmentRate": 74.6,
          "unemploymentRate": 4.2,
          "inactivityRate": 22.1
        },
        {
          "period": "2024 JAN-MAR",
          "observedAt": 1711843200000,
          "employmentRate": 74.5,
          "unemploymentRate": 4.3,
          "inactivityRate": 22
        },
        {
          "period": "2024 FEB-APR",
          "observedAt": 1714435200000,
          "employmentRate": 74.4,
          "unemploymentRate": 4.4,
          "inactivityRate": 22.1
        },
        {
          "period": "2024 MAR-MAY",
          "observedAt": 1717113600000,
          "employmentRate": 74.4,
          "unemploymentRate": 4.4,
          "inactivityRate": 22.1
        },
        {
          "period": "2024 APR-JUN",
          "observedAt": 1719705600000,
          "employmentRate": 74.5,
          "unemploymentRate": 4.2,
          "inactivityRate": 22.1
        },
        {
          "period": "2024 MAY-JUL",
          "observedAt": 1722384000000,
          "employmentRate": 74.7,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.9
        },
        {
          "period": "2024 JUN-AUG",
          "observedAt": 1725062400000,
          "employmentRate": 75,
          "unemploymentRate": 4.1,
          "inactivityRate": 21.8
        },
        {
          "period": "2024 JUL-SEP",
          "observedAt": 1727654400000,
          "employmentRate": 75,
          "unemploymentRate": 4.3,
          "inactivityRate": 21.6
        },
        {
          "period": "2024 AUG-OCT",
          "observedAt": 1730332800000,
          "employmentRate": 74.9,
          "unemploymentRate": 4.2,
          "inactivityRate": 21.7
        },
        {
          "period": "2024 SEP-NOV",
          "observedAt": 1732924800000,
          "employmentRate": 74.8,
          "unemploymentRate": 4.4,
          "inactivityRate": 21.6
        },
        {
          "period": "2024 OCT-DEC",
          "observedAt": 1735603200000,
          "employmentRate": 75,
          "unemploymentRate": 4.4,
          "inactivityRate": 21.5
        },
        {
          "period": "2025 NOV-JAN",
          "observedAt": 1738281600000,
          "employmentRate": 75,
          "unemploymentRate": 4.4,
          "inactivityRate": 21.5
        },
        {
          "period": "2025 DEC-FEB",
          "observedAt": 1740700800000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.5,
          "inactivityRate": 21.3
        },
        {
          "period": "2025 JAN-MAR",
          "observedAt": 1743379200000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.6,
          "inactivityRate": 21.3
        },
        {
          "period": "2025 FEB-APR",
          "observedAt": 1745971200000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.6,
          "inactivityRate": 21.2
        },
        {
          "period": "2025 MAR-MAY",
          "observedAt": 1748649600000,
          "employmentRate": 75.2,
          "unemploymentRate": 4.7,
          "inactivityRate": 21
        },
        {
          "period": "2025 APR-JUN",
          "observedAt": 1751241600000,
          "employmentRate": 75.3,
          "unemploymentRate": 4.7,
          "inactivityRate": 20.9
        },
        {
          "period": "2025 MAY-JUL",
          "observedAt": 1753920000000,
          "employmentRate": 75.2,
          "unemploymentRate": 4.7,
          "inactivityRate": 21
        },
        {
          "period": "2025 JUN-AUG",
          "observedAt": 1756598400000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.8,
          "inactivityRate": 21
        },
        {
          "period": "2025 JUL-SEP",
          "observedAt": 1759190400000,
          "employmentRate": 75.1,
          "unemploymentRate": 5,
          "inactivityRate": 20.9
        },
        {
          "period": "2025 AUG-OCT",
          "observedAt": 1761868800000,
          "employmentRate": 74.9,
          "unemploymentRate": 5.1,
          "inactivityRate": 21
        },
        {
          "period": "2025 SEP-NOV",
          "observedAt": 1764460800000,
          "employmentRate": 75.1,
          "unemploymentRate": 5.1,
          "inactivityRate": 20.8
        },
        {
          "period": "2025 OCT-DEC",
          "observedAt": 1767139200000,
          "employmentRate": 75,
          "unemploymentRate": 5.2,
          "inactivityRate": 20.9
        },
        {
          "period": "2026 NOV-JAN",
          "observedAt": 1769817600000,
          "employmentRate": 75.1,
          "unemploymentRate": 5.2,
          "inactivityRate": 20.7
        },
        {
          "period": "2026 DEC-FEB",
          "observedAt": 1772236800000,
          "employmentRate": 75,
          "unemploymentRate": 4.9,
          "inactivityRate": 21
        },
        {
          "period": "2026 JAN-MAR",
          "observedAt": 1774915200000,
          "employmentRate": 75,
          "unemploymentRate": 5,
          "inactivityRate": 20.9
        },
        {
          "period": "2026 FEB-APR",
          "observedAt": 1777507200000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.9,
          "inactivityRate": 21
        },
        {
          "period": "2026 MAR-MAY",
          "observedAt": 1780185600000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.9,
          "inactivityRate": 20.9
        },
        {
          "period": "2026 APR-JUN",
          "observedAt": 1782777600000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.9,
          "inactivityRate": 20.9
        },
        {
          "period": "2026 MAY-JUL",
          "observedAt": 1785456000000,
          "employmentRate": 75.1,
          "unemploymentRate": 4.9,
          "inactivityRate": 20.9
        }
      ],
      "vacancies": [
        {
          "period": "2016 JUL-SEP",
          "observedAt": 1475193600000,
          "vacancies": 756000
        },
        {
          "period": "2016 AUG-OCT",
          "observedAt": 1477872000000,
          "vacancies": 765000
        },
        {
          "period": "2016 SEP-NOV",
          "observedAt": 1480464000000,
          "vacancies": 757000
        },
        {
          "period": "2016 OCT-DEC",
          "observedAt": 1483142400000,
          "vacancies": 753000
        },
        {
          "period": "2017 NOV-JAN",
          "observedAt": 1485820800000,
          "vacancies": 744000
        },
        {
          "period": "2017 DEC-FEB",
          "observedAt": 1488240000000,
          "vacancies": 759000
        },
        {
          "period": "2017 JAN-MAR",
          "observedAt": 1490918400000,
          "vacancies": 766000
        },
        {
          "period": "2017 FEB-APR",
          "observedAt": 1493510400000,
          "vacancies": 789000
        },
        {
          "period": "2017 MAR-MAY",
          "observedAt": 1496188800000,
          "vacancies": 787000
        },
        {
          "period": "2017 APR-JUN",
          "observedAt": 1498780800000,
          "vacancies": 792000
        },
        {
          "period": "2017 MAY-JUL",
          "observedAt": 1501459200000,
          "vacancies": 793000
        },
        {
          "period": "2017 JUN-AUG",
          "observedAt": 1504137600000,
          "vacancies": 801000
        },
        {
          "period": "2017 JUL-SEP",
          "observedAt": 1506729600000,
          "vacancies": 806000
        },
        {
          "period": "2017 AUG-OCT",
          "observedAt": 1509408000000,
          "vacancies": 811000
        },
        {
          "period": "2017 SEP-NOV",
          "observedAt": 1512000000000,
          "vacancies": 816000
        },
        {
          "period": "2017 OCT-DEC",
          "observedAt": 1514678400000,
          "vacancies": 815000
        },
        {
          "period": "2018 NOV-JAN",
          "observedAt": 1517356800000,
          "vacancies": 809000
        },
        {
          "period": "2018 DEC-FEB",
          "observedAt": 1519776000000,
          "vacancies": 806000
        },
        {
          "period": "2018 JAN-MAR",
          "observedAt": 1522454400000,
          "vacancies": 808000
        },
        {
          "period": "2018 FEB-APR",
          "observedAt": 1525046400000,
          "vacancies": 808000
        },
        {
          "period": "2018 MAR-MAY",
          "observedAt": 1527724800000,
          "vacancies": 822000
        },
        {
          "period": "2018 APR-JUN",
          "observedAt": 1530316800000,
          "vacancies": 841000
        },
        {
          "period": "2018 MAY-JUL",
          "observedAt": 1532995200000,
          "vacancies": 849000
        },
        {
          "period": "2018 JUN-AUG",
          "observedAt": 1535673600000,
          "vacancies": 853000
        },
        {
          "period": "2018 JUL-SEP",
          "observedAt": 1538265600000,
          "vacancies": 853000
        },
        {
          "period": "2018 AUG-OCT",
          "observedAt": 1540944000000,
          "vacancies": 862000
        },
        {
          "period": "2018 SEP-NOV",
          "observedAt": 1543536000000,
          "vacancies": 856000
        },
        {
          "period": "2018 OCT-DEC",
          "observedAt": 1546214400000,
          "vacancies": 848000
        },
        {
          "period": "2019 NOV-JAN",
          "observedAt": 1548892800000,
          "vacancies": 845000
        },
        {
          "period": "2019 DEC-FEB",
          "observedAt": 1551312000000,
          "vacancies": 836000
        },
        {
          "period": "2019 JAN-MAR",
          "observedAt": 1553990400000,
          "vacancies": 837000
        },
        {
          "period": "2019 FEB-APR",
          "observedAt": 1556582400000,
          "vacancies": 837000
        },
        {
          "period": "2019 MAR-MAY",
          "observedAt": 1559260800000,
          "vacancies": 837000
        },
        {
          "period": "2019 APR-JUN",
          "observedAt": 1561852800000,
          "vacancies": 835000
        },
        {
          "period": "2019 MAY-JUL",
          "observedAt": 1564531200000,
          "vacancies": 835000
        },
        {
          "period": "2019 JUN-AUG",
          "observedAt": 1567209600000,
          "vacancies": 830000
        },
        {
          "period": "2019 JUL-SEP",
          "observedAt": 1569801600000,
          "vacancies": 827000
        },
        {
          "period": "2019 AUG-OCT",
          "observedAt": 1572480000000,
          "vacancies": 809000
        },
        {
          "period": "2019 SEP-NOV",
          "observedAt": 1575072000000,
          "vacancies": 800000
        },
        {
          "period": "2019 OCT-DEC",
          "observedAt": 1577750400000,
          "vacancies": 799000
        },
        {
          "period": "2020 NOV-JAN",
          "observedAt": 1580428800000,
          "vacancies": 800000
        },
        {
          "period": "2020 DEC-FEB",
          "observedAt": 1582934400000,
          "vacancies": 808000
        },
        {
          "period": "2020 JAN-MAR",
          "observedAt": 1585612800000,
          "vacancies": 788000
        },
        {
          "period": "2020 FEB-APR",
          "observedAt": 1588204800000,
          "vacancies": 635000
        },
        {
          "period": "2020 MAR-MAY",
          "observedAt": 1590883200000,
          "vacancies": 476000
        },
        {
          "period": "2020 APR-JUN",
          "observedAt": 1593475200000,
          "vacancies": 343000
        },
        {
          "period": "2020 MAY-JUL",
          "observedAt": 1596153600000,
          "vacancies": 384000
        },
        {
          "period": "2020 JUN-AUG",
          "observedAt": 1598832000000,
          "vacancies": 445000
        },
        {
          "period": "2020 JUL-SEP",
          "observedAt": 1601424000000,
          "vacancies": 499000
        },
        {
          "period": "2020 AUG-OCT",
          "observedAt": 1604102400000,
          "vacancies": 530000
        },
        {
          "period": "2020 SEP-NOV",
          "observedAt": 1606694400000,
          "vacancies": 549000
        },
        {
          "period": "2020 OCT-DEC",
          "observedAt": 1609372800000,
          "vacancies": 586000
        },
        {
          "period": "2021 NOV-JAN",
          "observedAt": 1612051200000,
          "vacancies": 603000
        },
        {
          "period": "2021 DEC-FEB",
          "observedAt": 1614470400000,
          "vacancies": 609000
        },
        {
          "period": "2021 JAN-MAR",
          "observedAt": 1617148800000,
          "vacancies": 621000
        },
        {
          "period": "2021 FEB-APR",
          "observedAt": 1619740800000,
          "vacancies": 660000
        },
        {
          "period": "2021 MAR-MAY",
          "observedAt": 1622419200000,
          "vacancies": 771000
        },
        {
          "period": "2021 APR-JUN",
          "observedAt": 1625011200000,
          "vacancies": 883000
        },
        {
          "period": "2021 MAY-JUL",
          "observedAt": 1627689600000,
          "vacancies": 983000
        },
        {
          "period": "2021 JUN-AUG",
          "observedAt": 1630368000000,
          "vacancies": 1068000
        },
        {
          "period": "2021 JUL-SEP",
          "observedAt": 1632960000000,
          "vacancies": 1132000
        },
        {
          "period": "2021 AUG-OCT",
          "observedAt": 1635638400000,
          "vacancies": 1208000
        },
        {
          "period": "2021 SEP-NOV",
          "observedAt": 1638230400000,
          "vacancies": 1229000
        },
        {
          "period": "2021 OCT-DEC",
          "observedAt": 1640908800000,
          "vacancies": 1244000
        },
        {
          "period": "2022 NOV-JAN",
          "observedAt": 1643587200000,
          "vacancies": 1245000
        },
        {
          "period": "2022 DEC-FEB",
          "observedAt": 1646006400000,
          "vacancies": 1254000
        },
        {
          "period": "2022 JAN-MAR",
          "observedAt": 1648684800000,
          "vacancies": 1259000
        },
        {
          "period": "2022 FEB-APR",
          "observedAt": 1651276800000,
          "vacancies": 1277000
        },
        {
          "period": "2022 MAR-MAY",
          "observedAt": 1653955200000,
          "vacancies": 1293000
        },
        {
          "period": "2022 APR-JUN",
          "observedAt": 1656547200000,
          "vacancies": 1294000
        },
        {
          "period": "2022 MAY-JUL",
          "observedAt": 1659225600000,
          "vacancies": 1272000
        },
        {
          "period": "2022 JUN-AUG",
          "observedAt": 1661904000000,
          "vacancies": 1257000
        },
        {
          "period": "2022 JUL-SEP",
          "observedAt": 1664496000000,
          "vacancies": 1235000
        },
        {
          "period": "2022 AUG-OCT",
          "observedAt": 1667174400000,
          "vacancies": 1216000
        },
        {
          "period": "2022 SEP-NOV",
          "observedAt": 1669766400000,
          "vacancies": 1170000
        },
        {
          "period": "2022 OCT-DEC",
          "observedAt": 1672444800000,
          "vacancies": 1138000
        },
        {
          "period": "2023 NOV-JAN",
          "observedAt": 1675123200000,
          "vacancies": 1108000
        },
        {
          "period": "2023 DEC-FEB",
          "observedAt": 1677542400000,
          "vacancies": 1101000
        },
        {
          "period": "2023 JAN-MAR",
          "observedAt": 1680220800000,
          "vacancies": 1089000
        },
        {
          "period": "2023 FEB-APR",
          "observedAt": 1682812800000,
          "vacancies": 1065000
        },
        {
          "period": "2023 MAR-MAY",
          "observedAt": 1685491200000,
          "vacancies": 1040000
        },
        {
          "period": "2023 APR-JUN",
          "observedAt": 1688083200000,
          "vacancies": 1029000
        },
        {
          "period": "2023 MAY-JUL",
          "observedAt": 1690761600000,
          "vacancies": 1018000
        },
        {
          "period": "2023 JUN-AUG",
          "observedAt": 1693440000000,
          "vacancies": 999000
        },
        {
          "period": "2023 JUL-SEP",
          "observedAt": 1696032000000,
          "vacancies": 984000
        },
        {
          "period": "2023 AUG-OCT",
          "observedAt": 1698710400000,
          "vacancies": 958000
        },
        {
          "period": "2023 SEP-NOV",
          "observedAt": 1701302400000,
          "vacancies": 951000
        },
        {
          "period": "2023 OCT-DEC",
          "observedAt": 1703980800000,
          "vacancies": 923000
        },
        {
          "period": "2024 NOV-JAN",
          "observedAt": 1706659200000,
          "vacancies": 910000
        },
        {
          "period": "2024 DEC-FEB",
          "observedAt": 1709164800000,
          "vacancies": 895000
        },
        {
          "period": "2024 JAN-MAR",
          "observedAt": 1711843200000,
          "vacancies": 893000
        },
        {
          "period": "2024 FEB-APR",
          "observedAt": 1714435200000,
          "vacancies": 885000
        },
        {
          "period": "2024 MAR-MAY",
          "observedAt": 1717113600000,
          "vacancies": 885000
        },
        {
          "period": "2024 APR-JUN",
          "observedAt": 1719705600000,
          "vacancies": 872000
        },
        {
          "period": "2024 MAY-JUL",
          "observedAt": 1722384000000,
          "vacancies": 867000
        },
        {
          "period": "2024 JUN-AUG",
          "observedAt": 1725062400000,
          "vacancies": 853000
        },
        {
          "period": "2024 JUL-SEP",
          "observedAt": 1727654400000,
          "vacancies": 840000
        },
        {
          "period": "2024 AUG-OCT",
          "observedAt": 1730332800000,
          "vacancies": 828000
        },
        {
          "period": "2024 SEP-NOV",
          "observedAt": 1732924800000,
          "vacancies": 810000
        },
        {
          "period": "2024 OCT-DEC",
          "observedAt": 1735603200000,
          "vacancies": 805000
        },
        {
          "period": "2025 NOV-JAN",
          "observedAt": 1738281600000,
          "vacancies": 798000
        },
        {
          "period": "2025 DEC-FEB",
          "observedAt": 1740700800000,
          "vacancies": 793000
        },
        {
          "period": "2025 JAN-MAR",
          "observedAt": 1743379200000,
          "vacancies": 775000
        },
        {
          "period": "2025 FEB-APR",
          "observedAt": 1745971200000,
          "vacancies": 759000
        },
        {
          "period": "2025 MAR-MAY",
          "observedAt": 1748649600000,
          "vacancies": 738000
        },
        {
          "period": "2025 APR-JUN",
          "observedAt": 1751241600000,
          "vacancies": 730000
        },
        {
          "period": "2025 MAY-JUL",
          "observedAt": 1753920000000,
          "vacancies": 727000
        },
        {
          "period": "2025 JUN-AUG",
          "observedAt": 1756598400000,
          "vacancies": 738000
        },
        {
          "period": "2025 JUL-SEP",
          "observedAt": 1759190400000,
          "vacancies": 729000
        },
        {
          "period": "2025 AUG-OCT",
          "observedAt": 1761868800000,
          "vacancies": 728000
        },
        {
          "period": "2025 SEP-NOV",
          "observedAt": 1764460800000,
          "vacancies": 730000
        },
        {
          "period": "2025 OCT-DEC",
          "observedAt": 1767139200000,
          "vacancies": 739000
        },
        {
          "period": "2026 NOV-JAN",
          "observedAt": 1769817600000,
          "vacancies": 734000
        },
        {
          "period": "2026 DEC-FEB",
          "observedAt": 1772236800000,
          "vacancies": 725000
        },
        {
          "period": "2026 JAN-MAR",
          "observedAt": 1774915200000,
          "vacancies": 718000
        },
        {
          "period": "2026 FEB-APR",
          "observedAt": 1777507200000,
          "vacancies": 713000
        },
        {
          "period": "2026 MAR-MAY",
          "observedAt": 1780185600000,
          "vacancies": 710000
        },
        {
          "period": "2026 APR-JUN",
          "observedAt": 1782777600000,
          "vacancies": 711000
        },
        {
          "period": "2026 MAY-JUL",
          "observedAt": 1785456000000,
          "vacancies": 706000
        },
        {
          "period": "2026 JUN-AUG",
          "observedAt": 1788134400000,
          "vacancies": 702000
        }
      ]
    },
    "series": {
      "employmentRate": {
        "id": "LF24",
        "url": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/timeseries/lf24/lms"
      },
      "unemploymentRate": {
        "id": "MGSX",
        "url": "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms"
      },
      "inactivityRate": {
        "id": "LF2S",
        "url": "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/economicinactivity/timeseries/lf2s/lms"
      },
      "vacancies": {
        "id": "AP2Y",
        "url": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/timeseries/ap2y/unem"
      }
    },
    "expiresAt": "2026-11-24T00:00:00.000Z",
    "__observation": {
      "status": "current",
      "period": "May to July 2026",
      "observedAt": "2026-07-31T00:00:00.000Z",
      "checkedAt": "2026-10-01T15:26:31.766Z",
      "maxAgeDays": 70
    },
    "__provenance": {
      "registryVersion": "2026-08-02.1",
      "section": "employmentStats",
      "title": "UK labour market",
      "evidenceClass": "official-data",
      "geography": "United Kingdom",
      "retrieval": "scheduled-publication-check",
      "refreshCadence": "daily",
      "publicationCadence": "monthly",
      "operationalStatus": "active",
      "publicationRequirement": "required",
      "upstreams": [
        {
          "publisher": "Office for National Statistics",
          "label": "UK labour market bulletin",
          "url": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/latest",
          "sourceClass": "official-primary",
          "caveat": "The Worker keeps Labour Force Survey and vacancies periods explicit and discovers the latest bulletin edition."
        }
      ]
    }
  },
  "migrationStats": {
    "headline": {
      "period": "YE December 2025",
      "observedAt": 1767139200000,
      "releaseDate": "2026-05-21",
      "netMigration": 171000,
      "immigration": 813000,
      "emigration": 642000,
      "previousPeriod": "YE December 2024",
      "previousNetMigration": 331000,
      "changePercent": -48,
      "provisional": true
    },
    "comparison": [
      {
        "period": "YE December 2024",
        "netMigration": 331000
      },
      {
        "period": "YE December 2025",
        "netMigration": 171000
      }
    ],
    "methodology": {
      "definition": "People moving to or from the UK for 12 months or more",
      "status": "Official statistics in development",
      "revisionNote": "The newest estimates are provisional for a year and earlier periods may be revised when methods or source data improve."
    },
    "source": {
      "edition": "yearendingdecember2025",
      "bulletinUrl": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/bulletins/longterminternationalmigrationprovisional/yearendingdecember2025",
      "datasetUrl": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional",
      "historyUrl": "https://www.ons.gov.uk/visualisations/dvc3538/fig02/data.csv"
    },
    "history": [
      {
        "period": "YE December 2016",
        "observedAt": 1483142400000,
        "immigration": 772000,
        "emigration": 523000,
        "netMigration": 249000
      },
      {
        "period": "YE December 2017",
        "observedAt": 1514678400000,
        "immigration": 752000,
        "emigration": 544000,
        "netMigration": 208000
      },
      {
        "period": "YE December 2018",
        "observedAt": 1546214400000,
        "immigration": 825000,
        "emigration": 549000,
        "netMigration": 276000
      },
      {
        "period": "YE December 2019",
        "observedAt": 1577750400000,
        "immigration": 788000,
        "emigration": 605000,
        "netMigration": 184000
      },
      {
        "period": "YE December 2020",
        "observedAt": 1609372800000,
        "immigration": 662000,
        "emigration": 569000,
        "netMigration": 93000
      },
      {
        "period": "YE December 2021",
        "observedAt": 1640908800000,
        "immigration": 947000,
        "emigration": 480000,
        "netMigration": 467000
      },
      {
        "period": "YE December 2022",
        "observedAt": 1672444800000,
        "immigration": 1398000,
        "emigration": 508000,
        "netMigration": 891000
      },
      {
        "period": "YE December 2023",
        "observedAt": 1703980800000,
        "immigration": 1441000,
        "emigration": 593000,
        "netMigration": 848000
      },
      {
        "period": "YE December 2024",
        "observedAt": 1735603200000,
        "immigration": 1012000,
        "emigration": 680000,
        "netMigration": 331000
      },
      {
        "period": "YE December 2025",
        "observedAt": 1767139200000,
        "immigration": 813000,
        "emigration": 642000,
        "netMigration": 171000
      }
    ],
    "annualDelta": {
      "immigration": -199000,
      "emigration": -38000,
      "netMigration": -160000
    },
    "expiresAt": "2026-12-27T00:00:00.000Z",
    "__observation": {
      "status": "current",
      "period": "YE December 2025",
      "observedAt": "2025-12-31T00:00:00.000Z",
      "checkedAt": "2026-10-01T15:26:55.766Z",
      "maxAgeDays": 220
    },
    "__provenance": {
      "registryVersion": "2026-08-02.1",
      "section": "migrationStats",
      "title": "Long-term international migration",
      "evidenceClass": "official-data",
      "geography": "United Kingdom",
      "retrieval": "scheduled-publication-check",
      "refreshCadence": "daily",
      "publicationCadence": "periodic",
      "operationalStatus": "active",
      "publicationRequirement": "required",
      "upstreams": [
        {
          "publisher": "Office for National Statistics",
          "label": "Long-term international migration, provisional bulletin",
          "url": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/bulletins/longterminternationalmigrationprovisional/yearendingdecember2025",
          "sourceClass": "official-primary",
          "caveat": "The Worker discovers the current edition from the rolling dataset page before retrieving the bulletin; this URL records the edition verified on 14 July 2026."
        },
        {
          "publisher": "Office for National Statistics",
          "label": "Long-term immigration, emigration and net migration dataset",
          "url": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional",
          "sourceClass": "official-primary"
        }
      ]
    }
  },
  "realWages": {
    "headline": {
      "period": "May to Jul 2026",
      "observedAt": 1785456000000,
      "releaseDate": "2026-09-15",
      "regularPayRealGrowthPercent": 0.6,
      "totalPayRealGrowthPercent": 0.9,
      "deflator": "CPIH"
    },
    "methodology": {
      "measure": "Average weekly earnings growth, adjusted for inflation using the Consumer Prices Index including owner occupiers' housing costs (CPIH)",
      "status": "Accredited official statistics",
      "revisionNote": "Average weekly earnings are published on a provisional basis and are subject to revision as later source data and seasonal-adjustment reviews are incorporated."
    },
    "source": {
      "edition": "september2026",
      "bulletinUrl": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/september2026",
      "historyUrl": "https://www.ons.gov.uk/generator?uri=/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/september2026/06d22b85&format=csv"
    },
    "history": [
      {
        "period": "Jun to Aug 2016",
        "observedAt": 1472601600000,
        "totalPayRealGrowthPercent": 1.6,
        "regularPayRealGrowthPercent": 1.4,
        "cpihAnnualRatePercent": 0.9
      },
      {
        "period": "Jul to Sep 2016",
        "observedAt": 1475193600000,
        "totalPayRealGrowthPercent": 1.4,
        "regularPayRealGrowthPercent": 1.3,
        "cpihAnnualRatePercent": 1.1
      },
      {
        "period": "Aug to Oct 2016",
        "observedAt": 1477872000000,
        "totalPayRealGrowthPercent": 1.3,
        "regularPayRealGrowthPercent": 1.3,
        "cpihAnnualRatePercent": 1.2
      },
      {
        "period": "Sep to Nov 2016",
        "observedAt": 1480464000000,
        "totalPayRealGrowthPercent": 1.3,
        "regularPayRealGrowthPercent": 1.3,
        "cpihAnnualRatePercent": 1.4
      },
      {
        "period": "Oct to Dec 2016",
        "observedAt": 1483142400000,
        "totalPayRealGrowthPercent": 0.9,
        "regularPayRealGrowthPercent": 1,
        "cpihAnnualRatePercent": 1.5
      },
      {
        "period": "Nov to Jan 2017",
        "observedAt": 1485820800000,
        "totalPayRealGrowthPercent": 0.4,
        "regularPayRealGrowthPercent": 0.6,
        "cpihAnnualRatePercent": 1.7
      },
      {
        "period": "Dec to Feb 2017",
        "observedAt": 1488240000000,
        "totalPayRealGrowthPercent": 0.1,
        "regularPayRealGrowthPercent": 0,
        "cpihAnnualRatePercent": 2
      },
      {
        "period": "Jan to Mar 2017",
        "observedAt": 1490918400000,
        "totalPayRealGrowthPercent": 0.1,
        "regularPayRealGrowthPercent": -0.3,
        "cpihAnnualRatePercent": 2.2
      },
      {
        "period": "Feb to Apr 2017",
        "observedAt": 1493510400000,
        "totalPayRealGrowthPercent": -0.2,
        "regularPayRealGrowthPercent": -0.6,
        "cpihAnnualRatePercent": 2.4
      },
      {
        "period": "Mar to May 2017",
        "observedAt": 1496188800000,
        "totalPayRealGrowthPercent": -0.5,
        "regularPayRealGrowthPercent": -0.5,
        "cpihAnnualRatePercent": 2.5
      },
      {
        "period": "Apr to Jun 2017",
        "observedAt": 1498780800000,
        "totalPayRealGrowthPercent": -0.4,
        "regularPayRealGrowthPercent": -0.5,
        "cpihAnnualRatePercent": 2.6
      },
      {
        "period": "May to Jul 2017",
        "observedAt": 1501459200000,
        "totalPayRealGrowthPercent": -0.3,
        "regularPayRealGrowthPercent": -0.4,
        "cpihAnnualRatePercent": 2.6
      },
      {
        "period": "Jun to Aug 2017",
        "observedAt": 1504137600000,
        "totalPayRealGrowthPercent": -0.3,
        "regularPayRealGrowthPercent": -0.4,
        "cpihAnnualRatePercent": 2.6
      },
      {
        "period": "Jul to Sep 2017",
        "observedAt": 1506729600000,
        "totalPayRealGrowthPercent": -0.4,
        "regularPayRealGrowthPercent": -0.4,
        "cpihAnnualRatePercent": 2.7
      },
      {
        "period": "Aug to Oct 2017",
        "observedAt": 1509408000000,
        "totalPayRealGrowthPercent": -0.2,
        "regularPayRealGrowthPercent": -0.4,
        "cpihAnnualRatePercent": 2.8
      },
      {
        "period": "Sep to Nov 2017",
        "observedAt": 1512000000000,
        "totalPayRealGrowthPercent": -0.3,
        "regularPayRealGrowthPercent": -0.4,
        "cpihAnnualRatePercent": 2.8
      },
      {
        "period": "Oct to Dec 2017",
        "observedAt": 1514678400000,
        "totalPayRealGrowthPercent": -0.2,
        "regularPayRealGrowthPercent": -0.3,
        "cpihAnnualRatePercent": 2.8
      },
      {
        "period": "Nov to Jan 2018",
        "observedAt": 1517356800000,
        "totalPayRealGrowthPercent": -0.2,
        "regularPayRealGrowthPercent": -0.2,
        "cpihAnnualRatePercent": 2.7
      },
      {
        "period": "Dec to Feb 2018",
        "observedAt": 1519776000000,
        "totalPayRealGrowthPercent": 0,
        "regularPayRealGrowthPercent": 0.1,
        "cpihAnnualRatePercent": 2.6
      },
      {
        "period": "Jan to Mar 2018",
        "observedAt": 1522454400000,
        "totalPayRealGrowthPercent": 0.1,
        "regularPayRealGrowthPercent": 0.3,
        "cpihAnnualRatePercent": 2.5
      },
      {
        "period": "Feb to Apr 2018",
        "observedAt": 1525046400000,
        "totalPayRealGrowthPercent": 0.3,
        "regularPayRealGrowthPercent": 0.5,
        "cpihAnnualRatePercent": 2.3
      },
      {
        "period": "Mar to May 2018",
        "observedAt": 1527724800000,
        "totalPayRealGrowthPercent": 0.4,
        "regularPayRealGrowthPercent": 0.4,
        "cpihAnnualRatePercent": 2.3
      },
      {
        "period": "Apr to Jun 2018",
        "observedAt": 1530316800000,
        "totalPayRealGrowthPercent": 0.3,
        "regularPayRealGrowthPercent": 0.4,
        "cpihAnnualRatePercent": 2.3
      },
      {
        "period": "May to Jul 2018",
        "observedAt": 1532995200000,
        "totalPayRealGrowthPercent": 0.4,
        "regularPayRealGrowthPercent": 0.5,
        "cpihAnnualRatePercent": 2.3
      },
      {
        "period": "Jun to Aug 2018",
        "observedAt": 1535673600000,
        "totalPayRealGrowthPercent": 0.6,
        "regularPayRealGrowthPercent": 0.7,
        "cpihAnnualRatePercent": 2.3
      },
      {
        "period": "Jul to Sep 2018",
        "observedAt": 1538265600000,
        "totalPayRealGrowthPercent": 0.8,
        "regularPayRealGrowthPercent": 0.9,
        "cpihAnnualRatePercent": 2.3
      },
      {
        "period": "Aug to Oct 2018",
        "observedAt": 1540944000000,
        "totalPayRealGrowthPercent": 1.1,
        "regularPayRealGrowthPercent": 1,
        "cpihAnnualRatePercent": 2.3
      },
      {
        "period": "Sep to Nov 2018",
        "observedAt": 1543536000000,
        "totalPayRealGrowthPercent": 1.2,
        "regularPayRealGrowthPercent": 1.1,
        "cpihAnnualRatePercent": 2.2
      },
      {
        "period": "Oct to Dec 2018",
        "observedAt": 1546214400000,
        "totalPayRealGrowthPercent": 1.3,
        "regularPayRealGrowthPercent": 1.3,
        "cpihAnnualRatePercent": 2.1
      },
      {
        "period": "Nov to Jan 2019",
        "observedAt": 1548892800000,
        "totalPayRealGrowthPercent": 1.2,
        "regularPayRealGrowthPercent": 1.5,
        "cpihAnnualRatePercent": 2
      },
      {
        "period": "Dec to Feb 2019",
        "observedAt": 1551312000000,
        "totalPayRealGrowthPercent": 1.3,
        "regularPayRealGrowthPercent": 1.5,
        "cpihAnnualRatePercent": 1.9
      },
      {
        "period": "Jan to Mar 2019",
        "observedAt": 1553990400000,
        "totalPayRealGrowthPercent": 1.3,
        "regularPayRealGrowthPercent": 1.5,
        "cpihAnnualRatePercent": 1.8
      },
      {
        "period": "Feb to Apr 2019",
        "observedAt": 1556582400000,
        "totalPayRealGrowthPercent": 1.4,
        "regularPayRealGrowthPercent": 1.5,
        "cpihAnnualRatePercent": 1.9
      },
      {
        "period": "Mar to May 2019",
        "observedAt": 1559260800000,
        "totalPayRealGrowthPercent": 1.7,
        "regularPayRealGrowthPercent": 1.7,
        "cpihAnnualRatePercent": 1.9
      },
      {
        "period": "Apr to Jun 2019",
        "observedAt": 1561852800000,
        "totalPayRealGrowthPercent": 2.1,
        "regularPayRealGrowthPercent": 2,
        "cpihAnnualRatePercent": 1.9
      },
      {
        "period": "May to Jul 2019",
        "observedAt": 1564531200000,
        "totalPayRealGrowthPercent": 2.1,
        "regularPayRealGrowthPercent": 1.9,
        "cpihAnnualRatePercent": 1.9
      },
      {
        "period": "Jun to Aug 2019",
        "observedAt": 1567209600000,
        "totalPayRealGrowthPercent": 1.9,
        "regularPayRealGrowthPercent": 1.9,
        "cpihAnnualRatePercent": 1.9
      },
      {
        "period": "Jul to Sep 2019",
        "observedAt": 1569801600000,
        "totalPayRealGrowthPercent": 2,
        "regularPayRealGrowthPercent": 1.8,
        "cpihAnnualRatePercent": 1.8
      },
      {
        "period": "Aug to Oct 2019",
        "observedAt": 1572480000000,
        "totalPayRealGrowthPercent": 1.6,
        "regularPayRealGrowthPercent": 1.8,
        "cpihAnnualRatePercent": 1.6
      },
      {
        "period": "Sep to Nov 2019",
        "observedAt": 1575072000000,
        "totalPayRealGrowthPercent": 1.6,
        "regularPayRealGrowthPercent": 1.7,
        "cpihAnnualRatePercent": 1.6
      },
      {
        "period": "Oct to Dec 2019",
        "observedAt": 1577750400000,
        "totalPayRealGrowthPercent": 1.2,
        "regularPayRealGrowthPercent": 1.7,
        "cpihAnnualRatePercent": 1.5
      },
      {
        "period": "Nov to Jan 2020",
        "observedAt": 1580428800000,
        "totalPayRealGrowthPercent": 1.3,
        "regularPayRealGrowthPercent": 1.5,
        "cpihAnnualRatePercent": 1.6
      },
      {
        "period": "Dec to Feb 2020",
        "observedAt": 1582934400000,
        "totalPayRealGrowthPercent": 0.9,
        "regularPayRealGrowthPercent": 1.3,
        "cpihAnnualRatePercent": 1.6
      },
      {
        "period": "Jan to Mar 2020",
        "observedAt": 1585612800000,
        "totalPayRealGrowthPercent": 0.5,
        "regularPayRealGrowthPercent": 1,
        "cpihAnnualRatePercent": 1.7
      },
      {
        "period": "Feb to Apr 2020",
        "observedAt": 1588204800000,
        "totalPayRealGrowthPercent": -0.4,
        "regularPayRealGrowthPercent": 0.4,
        "cpihAnnualRatePercent": 1.4
      },
      {
        "period": "Mar to May 2020",
        "observedAt": 1590883200000,
        "totalPayRealGrowthPercent": -1.2,
        "regularPayRealGrowthPercent": -0.3,
        "cpihAnnualRatePercent": 1
      },
      {
        "period": "Apr to Jun 2020",
        "observedAt": 1593475200000,
        "totalPayRealGrowthPercent": -1.8,
        "regularPayRealGrowthPercent": -0.9,
        "cpihAnnualRatePercent": 0.8
      },
      {
        "period": "May to Jul 2020",
        "observedAt": 1596153600000,
        "totalPayRealGrowthPercent": -1.7,
        "regularPayRealGrowthPercent": -0.6,
        "cpihAnnualRatePercent": 0.9
      },
      {
        "period": "Jun to Aug 2020",
        "observedAt": 1598832000000,
        "totalPayRealGrowthPercent": -0.6,
        "regularPayRealGrowthPercent": 0.2,
        "cpihAnnualRatePercent": 0.8
      },
      {
        "period": "Jul to Sep 2020",
        "observedAt": 1601424000000,
        "totalPayRealGrowthPercent": 0.7,
        "regularPayRealGrowthPercent": 1.2,
        "cpihAnnualRatePercent": 0.8
      },
      {
        "period": "Aug to Oct 2020",
        "observedAt": 1604102400000,
        "totalPayRealGrowthPercent": 2.1,
        "regularPayRealGrowthPercent": 2.1,
        "cpihAnnualRatePercent": 0.7
      },
      {
        "period": "Sep to Nov 2020",
        "observedAt": 1606694400000,
        "totalPayRealGrowthPercent": 3,
        "regularPayRealGrowthPercent": 2.8,
        "cpihAnnualRatePercent": 0.7
      },
      {
        "period": "Oct to Dec 2020",
        "observedAt": 1609372800000,
        "totalPayRealGrowthPercent": 3.8,
        "regularPayRealGrowthPercent": 3.2,
        "cpihAnnualRatePercent": 0.8
      },
      {
        "period": "Nov to Jan 2021",
        "observedAt": 1612051200000,
        "totalPayRealGrowthPercent": 3.9,
        "regularPayRealGrowthPercent": 3.5,
        "cpihAnnualRatePercent": 0.8
      },
      {
        "period": "Dec to Feb 2021",
        "observedAt": 1614470400000,
        "totalPayRealGrowthPercent": 3.6,
        "regularPayRealGrowthPercent": 3.5,
        "cpihAnnualRatePercent": 0.8
      },
      {
        "period": "Jan to Mar 2021",
        "observedAt": 1617148800000,
        "totalPayRealGrowthPercent": 3.2,
        "regularPayRealGrowthPercent": 3.6,
        "cpihAnnualRatePercent": 0.9
      },
      {
        "period": "Feb to Apr 2021",
        "observedAt": 1619740800000,
        "totalPayRealGrowthPercent": 4.5,
        "regularPayRealGrowthPercent": 4.4,
        "cpihAnnualRatePercent": 1.1
      },
      {
        "period": "Mar to May 2021",
        "observedAt": 1622419200000,
        "totalPayRealGrowthPercent": 5.8,
        "regularPayRealGrowthPercent": 4.9,
        "cpihAnnualRatePercent": 1.6
      },
      {
        "period": "Apr to Jun 2021",
        "observedAt": 1625011200000,
        "totalPayRealGrowthPercent": 6.8,
        "regularPayRealGrowthPercent": 5.2,
        "cpihAnnualRatePercent": 2
      },
      {
        "period": "May to Jul 2021",
        "observedAt": 1627689600000,
        "totalPayRealGrowthPercent": 6.2,
        "regularPayRealGrowthPercent": 4.6,
        "cpihAnnualRatePercent": 2.2
      },
      {
        "period": "Jun to Aug 2021",
        "observedAt": 1630368000000,
        "totalPayRealGrowthPercent": 4.7,
        "regularPayRealGrowthPercent": 3.5,
        "cpihAnnualRatePercent": 2.5
      },
      {
        "period": "Jul to Sep 2021",
        "observedAt": 1632960000000,
        "totalPayRealGrowthPercent": 3.1,
        "regularPayRealGrowthPercent": 2.3,
        "cpihAnnualRatePercent": 2.7
      },
      {
        "period": "Aug to Oct 2021",
        "observedAt": 1635638400000,
        "totalPayRealGrowthPercent": 1.7,
        "regularPayRealGrowthPercent": 1.1,
        "cpihAnnualRatePercent": 3.2
      },
      {
        "period": "Sep to Nov 2021",
        "observedAt": 1638230400000,
        "totalPayRealGrowthPercent": 0.6,
        "regularPayRealGrowthPercent": 0.2,
        "cpihAnnualRatePercent": 3.8
      },
      {
        "period": "Oct to Dec 2021",
        "observedAt": 1640908800000,
        "totalPayRealGrowthPercent": 0.5,
        "regularPayRealGrowthPercent": -0.5,
        "cpihAnnualRatePercent": 4.4
      },
      {
        "period": "Nov to Jan 2022",
        "observedAt": 1643587200000,
        "totalPayRealGrowthPercent": 0.4,
        "regularPayRealGrowthPercent": -0.7,
        "cpihAnnualRatePercent": 4.8
      },
      {
        "period": "Dec to Feb 2022",
        "observedAt": 1646006400000,
        "totalPayRealGrowthPercent": 1,
        "regularPayRealGrowthPercent": -0.7,
        "cpihAnnualRatePercent": 5.1
      },
      {
        "period": "Jan to Mar 2022",
        "observedAt": 1648684800000,
        "totalPayRealGrowthPercent": 1.7,
        "regularPayRealGrowthPercent": -0.9,
        "cpihAnnualRatePercent": 5.5
      },
      {
        "period": "Feb to Apr 2022",
        "observedAt": 1651276800000,
        "totalPayRealGrowthPercent": 0.6,
        "regularPayRealGrowthPercent": -1.8,
        "cpihAnnualRatePercent": 6.5
      },
      {
        "period": "Mar to May 2022",
        "observedAt": 1653955200000,
        "totalPayRealGrowthPercent": -0.8,
        "regularPayRealGrowthPercent": -2.4,
        "cpihAnnualRatePercent": 7.3
      },
      {
        "period": "Apr to Jun 2022",
        "observedAt": 1656547200000,
        "totalPayRealGrowthPercent": -2.5,
        "regularPayRealGrowthPercent": -2.8,
        "cpihAnnualRatePercent": 8
      },
      {
        "period": "May to Jul 2022",
        "observedAt": 1659225600000,
        "totalPayRealGrowthPercent": -2.5,
        "regularPayRealGrowthPercent": -2.7,
        "cpihAnnualRatePercent": 8.3
      },
      {
        "period": "Jun to Aug 2022",
        "observedAt": 1661904000000,
        "totalPayRealGrowthPercent": -2.3,
        "regularPayRealGrowthPercent": -2.7,
        "cpihAnnualRatePercent": 8.5
      },
      {
        "period": "Jul to Sep 2022",
        "observedAt": 1664496000000,
        "totalPayRealGrowthPercent": -2.6,
        "regularPayRealGrowthPercent": -2.7,
        "cpihAnnualRatePercent": 8.7
      },
      {
        "period": "Aug to Oct 2022",
        "observedAt": 1667174400000,
        "totalPayRealGrowthPercent": -2.6,
        "regularPayRealGrowthPercent": -2.6,
        "cpihAnnualRatePercent": 9
      },
      {
        "period": "Sep to Nov 2022",
        "observedAt": 1669766400000,
        "totalPayRealGrowthPercent": -2.5,
        "regularPayRealGrowthPercent": -2.5,
        "cpihAnnualRatePercent": 9.2
      },
      {
        "period": "Oct to Dec 2022",
        "observedAt": 1672444800000,
        "totalPayRealGrowthPercent": -2.9,
        "regularPayRealGrowthPercent": -2.5,
        "cpihAnnualRatePercent": 9.4
      },
      {
        "period": "Nov to Jan 2023",
        "observedAt": 1675123200000,
        "totalPayRealGrowthPercent": -2.7,
        "regularPayRealGrowthPercent": -2.3,
        "cpihAnnualRatePercent": 9.1
      },
      {
        "period": "Dec to Feb 2023",
        "observedAt": 1677542400000,
        "totalPayRealGrowthPercent": -2.7,
        "regularPayRealGrowthPercent": -2.2,
        "cpihAnnualRatePercent": 9.1
      },
      {
        "period": "Jan to Mar 2023",
        "observedAt": 1680220800000,
        "totalPayRealGrowthPercent": -2.5,
        "regularPayRealGrowthPercent": -1.9,
        "cpihAnnualRatePercent": 9
      },
      {
        "period": "Feb to Apr 2023",
        "observedAt": 1682812800000,
        "totalPayRealGrowthPercent": -1.8,
        "regularPayRealGrowthPercent": -1.2,
        "cpihAnnualRatePercent": 8.6
      },
      {
        "period": "Mar to May 2023",
        "observedAt": 1685491200000,
        "totalPayRealGrowthPercent": -1.1,
        "regularPayRealGrowthPercent": -0.6,
        "cpihAnnualRatePercent": 8.2
      },
      {
        "period": "Apr to Jun 2023",
        "observedAt": 1688083200000,
        "totalPayRealGrowthPercent": 0.5,
        "regularPayRealGrowthPercent": 0.1,
        "cpihAnnualRatePercent": 7.7
      },
      {
        "period": "May to Jul 2023",
        "observedAt": 1690761600000,
        "totalPayRealGrowthPercent": 1.2,
        "regularPayRealGrowthPercent": 0.6,
        "cpihAnnualRatePercent": 7.2
      },
      {
        "period": "Jun to Aug 2023",
        "observedAt": 1693440000000,
        "totalPayRealGrowthPercent": 1.4,
        "regularPayRealGrowthPercent": 1.1,
        "cpihAnnualRatePercent": 6.7
      },
      {
        "period": "Jul to Sep 2023",
        "observedAt": 1696032000000,
        "totalPayRealGrowthPercent": 1.4,
        "regularPayRealGrowthPercent": 1.3,
        "cpihAnnualRatePercent": 6.3
      },
      {
        "period": "Aug to Oct 2023",
        "observedAt": 1698710400000,
        "totalPayRealGrowthPercent": 1.3,
        "regularPayRealGrowthPercent": 1.3,
        "cpihAnnualRatePercent": 5.8
      },
      {
        "period": "Sep to Nov 2023",
        "observedAt": 1701302400000,
        "totalPayRealGrowthPercent": 1.5,
        "regularPayRealGrowthPercent": 1.5,
        "cpihAnnualRatePercent": 5.1
      },
      {
        "period": "Oct to Dec 2023",
        "observedAt": 1703980800000,
        "totalPayRealGrowthPercent": 1.5,
        "regularPayRealGrowthPercent": 1.7,
        "cpihAnnualRatePercent": 4.4
      },
      {
        "period": "Nov to Jan 2024",
        "observedAt": 1706659200000,
        "totalPayRealGrowthPercent": 1.6,
        "regularPayRealGrowthPercent": 1.8,
        "cpihAnnualRatePercent": 4.2
      },
      {
        "period": "Dec to Feb 2024",
        "observedAt": 1709164800000,
        "totalPayRealGrowthPercent": 1.8,
        "regularPayRealGrowthPercent": 1.8,
        "cpihAnnualRatePercent": 4.1
      },
      {
        "period": "Jan to Mar 2024",
        "observedAt": 1711843200000,
        "totalPayRealGrowthPercent": 1.8,
        "regularPayRealGrowthPercent": 1.9,
        "cpihAnnualRatePercent": 3.9
      },
      {
        "period": "Feb to Apr 2024",
        "observedAt": 1714435200000,
        "totalPayRealGrowthPercent": 2.1,
        "regularPayRealGrowthPercent": 2.2,
        "cpihAnnualRatePercent": 3.5
      },
      {
        "period": "Mar to May 2024",
        "observedAt": 1717113600000,
        "totalPayRealGrowthPercent": 2.3,
        "regularPayRealGrowthPercent": 2.5,
        "cpihAnnualRatePercent": 3.2
      },
      {
        "period": "Apr to Jun 2024",
        "observedAt": 1719705600000,
        "totalPayRealGrowthPercent": 1.8,
        "regularPayRealGrowthPercent": 2.6,
        "cpihAnnualRatePercent": 2.9
      },
      {
        "period": "May to Jul 2024",
        "observedAt": 1722384000000,
        "totalPayRealGrowthPercent": 1.4,
        "regularPayRealGrowthPercent": 2.4,
        "cpihAnnualRatePercent": 2.9
      },
      {
        "period": "Jun to Aug 2024",
        "observedAt": 1725062400000,
        "totalPayRealGrowthPercent": 1.1,
        "regularPayRealGrowthPercent": 2.2,
        "cpihAnnualRatePercent": 3
      },
      {
        "period": "Jul to Sep 2024",
        "observedAt": 1727654400000,
        "totalPayRealGrowthPercent": 1.7,
        "regularPayRealGrowthPercent": 2.1,
        "cpihAnnualRatePercent": 2.9
      },
      {
        "period": "Aug to Oct 2024",
        "observedAt": 1730332800000,
        "totalPayRealGrowthPercent": 2.3,
        "regularPayRealGrowthPercent": 2.4,
        "cpihAnnualRatePercent": 3
      },
      {
        "period": "Sep to Nov 2024",
        "observedAt": 1732924800000,
        "totalPayRealGrowthPercent": 2.3,
        "regularPayRealGrowthPercent": 2.4,
        "cpihAnnualRatePercent": 3.1
      },
      {
        "period": "Oct to Dec 2024",
        "observedAt": 1735603200000,
        "totalPayRealGrowthPercent": 2.5,
        "regularPayRealGrowthPercent": 2.4,
        "cpihAnnualRatePercent": 3.4
      },
      {
        "period": "Nov to Jan 2025",
        "observedAt": 1738281600000,
        "totalPayRealGrowthPercent": 2,
        "regularPayRealGrowthPercent": 2.1,
        "cpihAnnualRatePercent": 3.6
      },
      {
        "period": "Dec to Feb 2025",
        "observedAt": 1740700800000,
        "totalPayRealGrowthPercent": 2.1,
        "regularPayRealGrowthPercent": 2.1,
        "cpihAnnualRatePercent": 3.7
      },
      {
        "period": "Jan to Mar 2025",
        "observedAt": 1743379200000,
        "totalPayRealGrowthPercent": 1.8,
        "regularPayRealGrowthPercent": 1.8,
        "cpihAnnualRatePercent": 3.7
      },
      {
        "period": "Feb to Apr 2025",
        "observedAt": 1745971200000,
        "totalPayRealGrowthPercent": 1.4,
        "regularPayRealGrowthPercent": 1.5,
        "cpihAnnualRatePercent": 3.7
      },
      {
        "period": "Mar to May 2025",
        "observedAt": 1748649600000,
        "totalPayRealGrowthPercent": 0.8,
        "regularPayRealGrowthPercent": 1.1,
        "cpihAnnualRatePercent": 3.8
      },
      {
        "period": "Apr to Jun 2025",
        "observedAt": 1751241600000,
        "totalPayRealGrowthPercent": 0.4,
        "regularPayRealGrowthPercent": 0.9,
        "cpihAnnualRatePercent": 4.1
      },
      {
        "period": "May to Jul 2025",
        "observedAt": 1753920000000,
        "totalPayRealGrowthPercent": 0.6,
        "regularPayRealGrowthPercent": 0.7,
        "cpihAnnualRatePercent": 4.1
      },
      {
        "period": "Jun to Aug 2025",
        "observedAt": 1756598400000,
        "totalPayRealGrowthPercent": 0.9,
        "regularPayRealGrowthPercent": 0.6,
        "cpihAnnualRatePercent": 4.1
      },
      {
        "period": "Jul to Sep 2025",
        "observedAt": 1759190400000,
        "totalPayRealGrowthPercent": 0.8,
        "regularPayRealGrowthPercent": 0.5,
        "cpihAnnualRatePercent": 4.1
      },
      {
        "period": "Aug to Oct 2025",
        "observedAt": 1761868800000,
        "totalPayRealGrowthPercent": 0.8,
        "regularPayRealGrowthPercent": 0.6,
        "cpihAnnualRatePercent": 4
      },
      {
        "period": "Sep to Nov 2025",
        "observedAt": 1764460800000,
        "totalPayRealGrowthPercent": 0.7,
        "regularPayRealGrowthPercent": 0.6,
        "cpihAnnualRatePercent": 3.8
      },
      {
        "period": "Oct to Dec 2025",
        "observedAt": 1767139200000,
        "totalPayRealGrowthPercent": 0.5,
        "regularPayRealGrowthPercent": 0.5,
        "cpihAnnualRatePercent": 3.6
      },
      {
        "period": "Nov to Jan 2026",
        "observedAt": 1769817600000,
        "totalPayRealGrowthPercent": 0.8,
        "regularPayRealGrowthPercent": 0.4,
        "cpihAnnualRatePercent": 3.4
      },
      {
        "period": "Dec to Feb 2026",
        "observedAt": 1772236800000,
        "totalPayRealGrowthPercent": 0.6,
        "regularPayRealGrowthPercent": 0.2,
        "cpihAnnualRatePercent": 3.3
      },
      {
        "period": "Jan to Mar 2026",
        "observedAt": 1774915200000,
        "totalPayRealGrowthPercent": 1.1,
        "regularPayRealGrowthPercent": 0.1,
        "cpihAnnualRatePercent": 3.3
      },
      {
        "period": "Feb to Apr 2026",
        "observedAt": 1777507200000,
        "totalPayRealGrowthPercent": 1.2,
        "regularPayRealGrowthPercent": 0.1,
        "cpihAnnualRatePercent": 3.2
      },
      {
        "period": "Mar to May 2026",
        "observedAt": 1780185600000,
        "totalPayRealGrowthPercent": 1.2,
        "regularPayRealGrowthPercent": 0.3,
        "cpihAnnualRatePercent": 3.1
      },
      {
        "period": "Apr to Jun 2026",
        "observedAt": 1782777600000,
        "totalPayRealGrowthPercent": 1.2,
        "regularPayRealGrowthPercent": 0.6,
        "cpihAnnualRatePercent": 2.9
      },
      {
        "period": "May to Jul 2026",
        "observedAt": 1785456000000,
        "totalPayRealGrowthPercent": 0.9,
        "regularPayRealGrowthPercent": 0.6,
        "cpihAnnualRatePercent": 3
      }
    ],
    "expiresAt": "2026-10-25T00:00:00.000Z",
    "__observation": {
      "status": "current",
      "period": "May to Jul 2026",
      "observedAt": "2026-07-31T00:00:00.000Z",
      "checkedAt": "2026-10-01T15:27:12.905Z",
      "maxAgeDays": 40
    },
    "__provenance": {
      "registryVersion": "2026-08-02.1",
      "section": "realWages",
      "title": "Real-terms growth in average weekly earnings",
      "evidenceClass": "official-data",
      "geography": "Great Britain",
      "retrieval": "scheduled-publication-check",
      "refreshCadence": "daily",
      "publicationCadence": "monthly",
      "operationalStatus": "active",
      "publicationRequirement": "required",
      "upstreams": [
        {
          "publisher": "Office for National Statistics",
          "label": "Average weekly earnings in Great Britain bulletin",
          "url": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/latest",
          "sourceClass": "official-primary",
          "caveat": "The Worker discovers the current edition from the rolling bulletin alias and extracts ONS's own published real-terms (CPIH-adjusted) growth figure rather than deriving it from nominal pay and inflation separately."
        }
      ]
    }
  },
  "governmentContracts": {
    "available": true,
    "generatedAt": "2026-10-01T15:34:53.133Z",
    "window": {
      "updatedFrom": "2026-09-24T15:34:53.133Z",
      "updatedTo": "2026-10-01T15:34:52.133Z",
      "label": "24 Sept 2026 to 1 Oct 2026",
      "basis": "Find a Tender award-stage releases from seven complete UTC day shards collected by the Cloudflare Free data worker"
    },
    "source": {
      "publisher": "Cabinet Office",
      "service": "Find a Tender",
      "apiUrl": "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages",
      "documentationUrl": "https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages",
      "licenceUrl": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      "standard": "OCDS 1.1"
    },
    "summary": {
      "awardCount": 100,
      "disclosedValueTotal": 13153000000,
      "largestAwardValue": 820000000,
      "top10Share": 34.9,
      "distinctBuyers": 24,
      "distinctSuppliers": 52,
      "explicitDirectAwards": 10,
      "missingProcedure": 0,
      "frameworkAwards": 36,
      "topBuyer": {
        "name": "Crown Commercial Service",
        "awardCount": 7,
        "disclosedValue": 1455000000
      },
      "topSupplier": {
        "name": "Atos IT Services UK Limited",
        "awardCount": 24,
        "disclosedValue": 1157800000
      }
    },
    "awards": [
      {
        "rank": 1,
        "key": "ocds-h6vhtk-000001:award-1",
        "ocid": "ocds-h6vhtk-000001",
        "releaseId": "100001-2026",
        "awardId": "award-1",
        "title": "Crown Commercial Service Technology Services 4 Integration",
        "buyer": "Crown Commercial Service",
        "suppliers": [
          "Capgemini UK plc",
          "Kainos Software Limited"
        ],
        "supplierNations": [
          "England",
          "Northern Ireland"
        ],
        "awardDate": "2026-02-03T15:34:53.133Z",
        "publishedAt": "2026-02-07T15:34:53.133Z",
        "amount": 820000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework agreement call-off",
        "mainProcurementCategory": "services",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100001-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000001"
      },
      {
        "rank": 2,
        "key": "ocds-h6vhtk-000002:award-2",
        "ocid": "ocds-h6vhtk-000002",
        "releaseId": "100002-2026",
        "awardId": "award-2",
        "title": "National Highways Smart Motorway Safety Infrastructure Upgrade",
        "buyer": "National Highways",
        "suppliers": [
          "Balfour Beatty Group Ltd",
          "Costain Group PLC"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-03-05T15:34:53.133Z",
        "publishedAt": "2026-03-09T15:34:53.133Z",
        "amount": 675000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Competitive procedure with negotiation",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100002-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000002"
      },
      {
        "rank": 3,
        "key": "ocds-h6vhtk-000003:award-3",
        "ocid": "ocds-h6vhtk-000003",
        "releaseId": "100003-2026",
        "awardId": "award-3",
        "title": "NHS England Federated Data Platform Modernisation Programme",
        "buyer": "NHS England",
        "suppliers": [
          "Accenture UK Limited",
          "Palantir Technologies UK Ltd"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-04-04T15:34:53.133Z",
        "publishedAt": "2026-04-08T15:34:53.133Z",
        "amount": 540000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure",
        "mainProcurementCategory": "services",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100003-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000003"
      },
      {
        "rank": 4,
        "key": "ocds-h6vhtk-000004:award-4",
        "ocid": "ocds-h6vhtk-000004",
        "releaseId": "100004-2026",
        "awardId": "award-4",
        "title": "Ministry of Defence Naval Fleet Marine Engineering Support",
        "buyer": "Ministry of Defence",
        "suppliers": [
          "Babcock Marine Ltd"
        ],
        "supplierNations": [
          "Scotland"
        ],
        "awardDate": "2026-05-04T15:34:53.133Z",
        "publishedAt": "2026-05-08T15:34:53.133Z",
        "amount": 495000000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award under national security exemption",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100004-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000004"
      },
      {
        "rank": 5,
        "key": "ocds-h6vhtk-000005:award-5",
        "ocid": "ocds-h6vhtk-000005",
        "releaseId": "100005-2026",
        "awardId": "award-5",
        "title": "Department for Transport Rail Passenger Services Modernisation",
        "buyer": "Department for Transport",
        "suppliers": [
          "First Rail Holdings Ltd",
          "Keolis UK Ltd"
        ],
        "supplierNations": [
          "England",
          "Wales"
        ],
        "awardDate": "2026-02-03T15:34:53.133Z",
        "publishedAt": "2026-02-07T15:34:53.133Z",
        "amount": 430000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Public service contracts regulation award",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100005-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000005"
      },
      {
        "rank": 6,
        "key": "ocds-h6vhtk-000006:award-6",
        "ocid": "ocds-h6vhtk-000006",
        "releaseId": "100006-2026",
        "awardId": "award-6",
        "title": "HM Revenue & Customs Cloud Infrastructure & IT Systems Operation",
        "buyer": "HM Revenue and Customs",
        "suppliers": [
          "Amazon Web Services EMEA SARL",
          "Capgemini UK plc"
        ],
        "supplierNations": [
          "Other/Unknown",
          "England"
        ],
        "awardDate": "2026-06-03T15:34:53.133Z",
        "publishedAt": "2026-06-07T15:34:53.133Z",
        "amount": 385000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Crown Commercial Service Cloud Compute call-off",
        "mainProcurementCategory": "services",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100006-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000006"
      },
      {
        "rank": 7,
        "key": "ocds-h6vhtk-000007:award-7",
        "ocid": "ocds-h6vhtk-000007",
        "releaseId": "100007-2026",
        "awardId": "award-7",
        "title": "High Speed 2 Trackwork and Overhead Catenary System Lot 2",
        "buyer": "High Speed Two (HS2) Limited",
        "suppliers": [
          "Alstom Transport UK Ltd",
          "VolkerFitzpatrick Ltd"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-03-05T15:34:53.133Z",
        "publishedAt": "2026-03-09T15:34:53.133Z",
        "amount": 360000000,
        "currency": "GBP",
        "procurementMethod": "selective",
        "procurementMethodDetails": "Restricted procedure",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100007-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000007"
      },
      {
        "rank": 8,
        "key": "ocds-h6vhtk-000008:award-8",
        "ocid": "ocds-h6vhtk-000008",
        "releaseId": "100008-2026",
        "awardId": "award-8",
        "title": "Department for Work and Pensions NextGen Citizen Services Platform",
        "buyer": "Department for Work and Pensions",
        "suppliers": [
          "IBM United Kingdom Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-07-03T15:34:53.133Z",
        "publishedAt": "2026-07-07T15:34:53.133Z",
        "amount": 320000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100008-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000008"
      },
      {
        "rank": 9,
        "key": "ocds-h6vhtk-000009:award-9",
        "ocid": "ocds-h6vhtk-000009",
        "releaseId": "100009-2026",
        "awardId": "award-9",
        "title": "Scottish Ministers National Transport Decarbonisation Network",
        "buyer": "Scottish Ministers (Transport Scotland)",
        "suppliers": [
          "Scottish Power Energy Networks",
          "SSE Energy Solutions Ltd"
        ],
        "supplierNations": [
          "Scotland",
          "Scotland"
        ],
        "awardDate": "2026-04-04T15:34:53.133Z",
        "publishedAt": "2026-04-08T15:34:53.133Z",
        "amount": 295000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open tender",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100009-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000009"
      },
      {
        "rank": 10,
        "key": "ocds-h6vhtk-00000a:award-10",
        "ocid": "ocds-h6vhtk-00000a",
        "releaseId": "100010-2026",
        "awardId": "award-10",
        "title": "Home Office Future Digital Border and Biometric Verification Platform",
        "buyer": "Home Office",
        "suppliers": [
          "Fujitsu Services Limited",
          "Leidos Innovations UK Ltd"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-08-02T15:34:53.133Z",
        "publishedAt": "2026-08-06T15:34:53.133Z",
        "amount": 275000000,
        "currency": "GBP",
        "procurementMethod": "selective",
        "procurementMethodDetails": "Negotiated procedure",
        "mainProcurementCategory": "services",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100010-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00000a"
      },
      {
        "rank": 11,
        "key": "ocds-h6vhtk-00000b:award-11",
        "ocid": "ocds-h6vhtk-00000b",
        "releaseId": "100011-2026",
        "awardId": "award-11",
        "title": "Welsh Government Active Travel and Rail Infrastructure Programme",
        "buyer": "Welsh Government",
        "suppliers": [
          "Morgan Sindall Construction & Infrastructure Ltd"
        ],
        "supplierNations": [
          "Wales"
        ],
        "awardDate": "2026-02-03T15:34:53.133Z",
        "publishedAt": "2026-02-07T15:34:53.133Z",
        "amount": 250000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Civil engineering framework agreement",
        "mainProcurementCategory": "works",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100011-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00000b"
      },
      {
        "rank": 12,
        "key": "ocds-h6vhtk-00000c:award-12",
        "ocid": "ocds-h6vhtk-00000c",
        "releaseId": "100012-2026",
        "awardId": "award-12",
        "title": "Ministry of Defence Defence Digital Secure Communications Network",
        "buyer": "Ministry of Defence",
        "suppliers": [
          "Airbus Defence and Space Ltd"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-05-04T15:34:53.133Z",
        "publishedAt": "2026-05-08T15:34:53.133Z",
        "amount": 235000000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award",
        "mainProcurementCategory": "supplies",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100012-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00000c"
      },
      {
        "rank": 13,
        "key": "ocds-h6vhtk-00000d:award-13",
        "ocid": "ocds-h6vhtk-00000d",
        "releaseId": "100013-2026",
        "awardId": "award-13",
        "title": "Department for Education National School Rebuilding Programme Phase 3",
        "buyer": "Department for Education",
        "suppliers": [
          "Kier Construction Limited",
          "Willmott Dixon Construction Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-06-03T15:34:53.133Z",
        "publishedAt": "2026-06-07T15:34:53.133Z",
        "amount": 220000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "DfE Construction Framework 2021",
        "mainProcurementCategory": "works",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100013-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00000d"
      },
      {
        "rank": 14,
        "key": "ocds-h6vhtk-00000e:award-14",
        "ocid": "ocds-h6vhtk-00000e",
        "releaseId": "100014-2026",
        "awardId": "award-14",
        "title": "Environment Agency Thames Estuary Asset Management Programme",
        "buyer": "Environment Agency",
        "suppliers": [
          "CH2M HILL United Kingdom",
          "Mott MacDonald Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-04-04T15:34:53.133Z",
        "publishedAt": "2026-04-08T15:34:53.133Z",
        "amount": 210000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Competitive dialogue",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100014-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00000e"
      },
      {
        "rank": 15,
        "key": "ocds-h6vhtk-00000f:award-15",
        "ocid": "ocds-h6vhtk-00000f",
        "releaseId": "100015-2026",
        "awardId": "award-15",
        "title": "Northern Ireland Department for Infrastructure Regional Water Network",
        "buyer": "Northern Ireland Water",
        "suppliers": [
          "Farrans Construction",
          "Graham Construction Ltd"
        ],
        "supplierNations": [
          "Northern Ireland",
          "Northern Ireland"
        ],
        "awardDate": "2026-03-05T15:34:53.133Z",
        "publishedAt": "2026-03-09T15:34:53.133Z",
        "amount": 195000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Utilities contracts regulations tender",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100015-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00000f"
      },
      {
        "rank": 16,
        "key": "ocds-h6vhtk-000010:award-16",
        "ocid": "ocds-h6vhtk-000010",
        "releaseId": "100016-2026",
        "awardId": "award-16",
        "title": "Metropolitan Police Service Digital Forensic & Evidence Management",
        "buyer": "Mayor's Office for Policing and Crime (MOPAC)",
        "suppliers": [
          "Motorola Solutions UK Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-09-01T15:34:53.133Z",
        "publishedAt": "2026-09-05T15:34:53.133Z",
        "amount": 185000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100016-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000010"
      },
      {
        "rank": 17,
        "key": "ocds-h6vhtk-000011:award-17",
        "ocid": "ocds-h6vhtk-000011",
        "releaseId": "100017-2026",
        "awardId": "award-17",
        "title": "Department for Energy Security Clean Power Grid Connections Lot 4",
        "buyer": "Department for Energy Security and Net Zero",
        "suppliers": [
          "National Grid Electricity Transmission plc"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-02-03T15:34:53.133Z",
        "publishedAt": "2026-02-07T15:34:53.133Z",
        "amount": 175000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure",
        "mainProcurementCategory": "works",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100017-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000011"
      },
      {
        "rank": 18,
        "key": "ocds-h6vhtk-000012:award-18",
        "ocid": "ocds-h6vhtk-000012",
        "releaseId": "100018-2026",
        "awardId": "award-18",
        "title": "Crown Commercial Service G-Cloud 14 Enterprise Hosting Lot 1",
        "buyer": "Crown Commercial Service",
        "suppliers": [
          "Computacenter (UK) Ltd",
          "Softcat plc"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-07-03T15:34:53.133Z",
        "publishedAt": "2026-07-07T15:34:53.133Z",
        "amount": 165000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework agreement call-off",
        "mainProcurementCategory": "services",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100018-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000012"
      },
      {
        "rank": 19,
        "key": "ocds-h6vhtk-000013:award-19",
        "ocid": "ocds-h6vhtk-000013",
        "releaseId": "100019-2026",
        "awardId": "award-19",
        "title": "Cabinet Office Government Digital Service Identity & Verify Next Gen",
        "buyer": "Cabinet Office",
        "suppliers": [
          "Deloitte LLP",
          "Kainos Software Limited"
        ],
        "supplierNations": [
          "England",
          "Northern Ireland"
        ],
        "awardDate": "2026-05-04T15:34:53.133Z",
        "publishedAt": "2026-05-08T15:34:53.133Z",
        "amount": 155000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100019-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000013"
      },
      {
        "rank": 20,
        "key": "ocds-h6vhtk-000014:award-20",
        "ocid": "ocds-h6vhtk-000014",
        "releaseId": "100020-2026",
        "awardId": "award-20",
        "title": "NHS Supply Chain National Surgical Consumables and Diagnostic Kits",
        "buyer": "NHS Supply Chain (Supply Chain Coordination Limited)",
        "suppliers": [
          "Johnson & Johnson Medical Ltd",
          "Medtronic Limited"
        ],
        "supplierNations": [
          "Scotland",
          "England"
        ],
        "awardDate": "2026-03-05T15:34:53.133Z",
        "publishedAt": "2026-03-09T15:34:53.133Z",
        "amount": 148000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Dynamic purchasing system",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100020-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000014"
      },
      {
        "rank": 21,
        "key": "ocds-h6vhtk-000015:award-21",
        "ocid": "ocds-h6vhtk-000015",
        "releaseId": "100021-2026",
        "awardId": "award-21",
        "title": "Crown Commercial Service — Facilities and Secure Property Management Package 3",
        "buyer": "Crown Commercial Service",
        "suppliers": [
          "Arup Group Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-06-18T15:34:53.133Z",
        "publishedAt": "2026-06-20T15:34:53.133Z",
        "amount": 142000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100021-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000015"
      },
      {
        "rank": 22,
        "key": "ocds-h6vhtk-000016:award-22",
        "ocid": "ocds-h6vhtk-000016",
        "releaseId": "100022-2026",
        "awardId": "award-22",
        "title": "Transport for London — Cloud Infrastructure Integration and Support Package 3",
        "buyer": "Transport for London",
        "suppliers": [
          "Serco Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-05-19T15:34:53.133Z",
        "publishedAt": "2026-05-21T15:34:53.133Z",
        "amount": 140700000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award under urgent public interest",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100022-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000016"
      },
      {
        "rank": 23,
        "key": "ocds-h6vhtk-000017:award-23",
        "ocid": "ocds-h6vhtk-000017",
        "releaseId": "100023-2026",
        "awardId": "award-23",
        "title": "NHS England — Civil Infrastructure Engineering and Maintenance Package 3",
        "buyer": "NHS England",
        "suppliers": [
          "Mace Group Ltd"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-04-19T15:34:53.133Z",
        "publishedAt": "2026-04-21T15:34:53.133Z",
        "amount": 139200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100023-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000017"
      },
      {
        "rank": 24,
        "key": "ocds-h6vhtk-000018:award-24",
        "ocid": "ocds-h6vhtk-000018",
        "releaseId": "100024-2026",
        "awardId": "award-24",
        "title": "Department for Environment Food and Rural Affairs — Clinical Diagnostics and Health Monitoring Package 3",
        "buyer": "Department for Environment Food and Rural Affairs",
        "suppliers": [
          "Atos IT Services UK Limited",
          "QinetiQ Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-03-20T15:34:53.133Z",
        "publishedAt": "2026-03-22T15:34:53.133Z",
        "amount": 137500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100024-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000018"
      },
      {
        "rank": 25,
        "key": "ocds-h6vhtk-000019:award-25",
        "ocid": "ocds-h6vhtk-000019",
        "releaseId": "100025-2026",
        "awardId": "award-25",
        "title": "Department for Business and Trade — Digital Transformation Consultancy Services Package 3",
        "buyer": "Department for Business and Trade",
        "suppliers": [
          "Alun Griffiths (Contractors) Ltd"
        ],
        "supplierNations": [
          "Wales"
        ],
        "awardDate": "2026-02-18T15:34:53.133Z",
        "publishedAt": "2026-02-20T15:34:53.133Z",
        "amount": 135600000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100025-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000019"
      },
      {
        "rank": 26,
        "key": "ocds-h6vhtk-00001a:award-26",
        "ocid": "ocds-h6vhtk-00001a",
        "releaseId": "100026-2026",
        "awardId": "award-26",
        "title": "Department for Education — Renewable Power Generation and Energy Efficiency Package 3",
        "buyer": "Department for Education",
        "suppliers": [
          "Oracle Corporation UK Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-01-19T15:34:53.133Z",
        "publishedAt": "2026-01-21T15:34:53.133Z",
        "amount": 134500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100026-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00001a"
      },
      {
        "rank": 27,
        "key": "ocds-h6vhtk-00001b:award-27",
        "ocid": "ocds-h6vhtk-00001b",
        "releaseId": "100027-2026",
        "awardId": "award-27",
        "title": "Home Office — Cyber Security Monitoring and Incident Response Package 3",
        "buyer": "Home Office",
        "suppliers": [
          "Atos IT Services UK Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-09-16T15:34:53.133Z",
        "publishedAt": "2026-09-18T15:34:53.133Z",
        "amount": 133200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100027-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00001b"
      },
      {
        "rank": 28,
        "key": "ocds-h6vhtk-00001c:award-28",
        "ocid": "ocds-h6vhtk-00001c",
        "releaseId": "100028-2026",
        "awardId": "award-28",
        "title": "Department for Work and Pensions — Transport Network Telemetry and Sensor Systems Package 3",
        "buyer": "Department for Work and Pensions",
        "suppliers": [
          "Atos IT Services UK Limited",
          "WSP UK Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-08-17T15:34:53.133Z",
        "publishedAt": "2026-08-19T15:34:53.133Z",
        "amount": 131700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100028-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00001c"
      },
      {
        "rank": 29,
        "key": "ocds-h6vhtk-00001d:award-29",
        "ocid": "ocds-h6vhtk-00001d",
        "releaseId": "100029-2026",
        "awardId": "award-29",
        "title": "Scottish Government — Fleet Decarbonisation and Vehicle Maintenance Package 3",
        "buyer": "Scottish Government",
        "suppliers": [
          "Sodexo Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-07-18T15:34:53.133Z",
        "publishedAt": "2026-07-20T15:34:53.133Z",
        "amount": 130000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100029-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00001d"
      },
      {
        "rank": 30,
        "key": "ocds-h6vhtk-00001e:award-30",
        "ocid": "ocds-h6vhtk-00001e",
        "releaseId": "100030-2026",
        "awardId": "award-30",
        "title": "National Highways — Enterprise Software Systems Licensing Package 4",
        "buyer": "National Highways",
        "suppliers": [
          "Sir Robert McAlpine Ltd"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-06-18T15:34:53.133Z",
        "publishedAt": "2026-06-20T15:34:53.133Z",
        "amount": 128100000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "works",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100030-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00001e"
      },
      {
        "rank": 31,
        "key": "ocds-h6vhtk-00001f:award-31",
        "ocid": "ocds-h6vhtk-00001f",
        "releaseId": "100031-2026",
        "awardId": "award-31",
        "title": "High Speed Two (HS2) Limited — Facilities and Secure Property Management Package 4",
        "buyer": "High Speed Two (HS2) Limited",
        "suppliers": [
          "BAE Systems Surface Ships Ltd"
        ],
        "supplierNations": [
          "Scotland"
        ],
        "awardDate": "2026-05-19T15:34:53.133Z",
        "publishedAt": "2026-05-21T15:34:53.133Z",
        "amount": 127000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100031-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00001f"
      },
      {
        "rank": 32,
        "key": "ocds-h6vhtk-000020:award-32",
        "ocid": "ocds-h6vhtk-000020",
        "releaseId": "100032-2026",
        "awardId": "award-32",
        "title": "Ministry of Defence — Cloud Infrastructure Integration and Support Package 4",
        "buyer": "Ministry of Defence",
        "suppliers": [
          "Atos IT Services UK Limited",
          "McLaughlin & Harvey Ltd"
        ],
        "supplierNations": [
          "England",
          "Northern Ireland"
        ],
        "awardDate": "2026-04-19T15:34:53.133Z",
        "publishedAt": "2026-04-21T15:34:53.133Z",
        "amount": 125700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100032-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000020"
      },
      {
        "rank": 33,
        "key": "ocds-h6vhtk-000021:award-33",
        "ocid": "ocds-h6vhtk-000021",
        "releaseId": "100033-2026",
        "awardId": "award-33",
        "title": "Ministry of Justice — Civil Infrastructure Engineering and Maintenance Package 4",
        "buyer": "Ministry of Justice",
        "suppliers": [
          "Cisco International Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-03-20T15:34:53.133Z",
        "publishedAt": "2026-03-22T15:34:53.133Z",
        "amount": 124200000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award under urgent public interest",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100033-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000021"
      },
      {
        "rank": 34,
        "key": "ocds-h6vhtk-000022:award-34",
        "ocid": "ocds-h6vhtk-000022",
        "releaseId": "100034-2026",
        "awardId": "award-34",
        "title": "Foreign Commonwealth and Development Office — Clinical Diagnostics and Health Monitoring Package 4",
        "buyer": "Foreign Commonwealth and Development Office",
        "suppliers": [
          "Jacobs U.K. Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-02-18T15:34:53.133Z",
        "publishedAt": "2026-02-20T15:34:53.133Z",
        "amount": 122500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100034-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000022"
      },
      {
        "rank": 35,
        "key": "ocds-h6vhtk-000023:award-35",
        "ocid": "ocds-h6vhtk-000023",
        "releaseId": "100035-2026",
        "awardId": "award-35",
        "title": "HM Revenue and Customs — Digital Transformation Consultancy Services Package 4",
        "buyer": "HM Revenue and Customs",
        "suppliers": [
          "Amey Community Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-01-19T15:34:53.133Z",
        "publishedAt": "2026-01-21T15:34:53.133Z",
        "amount": 120600000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100035-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000023"
      },
      {
        "rank": 36,
        "key": "ocds-h6vhtk-000024:award-36",
        "ocid": "ocds-h6vhtk-000024",
        "releaseId": "100036-2026",
        "awardId": "award-36",
        "title": "Welsh Government — Renewable Power Generation and Energy Efficiency Package 4",
        "buyer": "Welsh Government",
        "suppliers": [
          "Atos IT Services UK Limited",
          "Mitie Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-09-16T15:34:53.133Z",
        "publishedAt": "2026-09-18T15:34:53.133Z",
        "amount": 119500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100036-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000024"
      },
      {
        "rank": 37,
        "key": "ocds-h6vhtk-000025:award-37",
        "ocid": "ocds-h6vhtk-000025",
        "releaseId": "100037-2026",
        "awardId": "award-37",
        "title": "Crown Commercial Service — Cyber Security Monitoring and Incident Response Package 4",
        "buyer": "Crown Commercial Service",
        "suppliers": [
          "Turner & Townsend Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-08-17T15:34:53.133Z",
        "publishedAt": "2026-08-19T15:34:53.133Z",
        "amount": 118200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100037-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000025"
      },
      {
        "rank": 38,
        "key": "ocds-h6vhtk-000026:award-38",
        "ocid": "ocds-h6vhtk-000026",
        "releaseId": "100038-2026",
        "awardId": "award-38",
        "title": "Transport for London — Transport Network Telemetry and Sensor Systems Package 4",
        "buyer": "Transport for London",
        "suppliers": [
          "Robertson Group (Holdings) Ltd"
        ],
        "supplierNations": [
          "Scotland"
        ],
        "awardDate": "2026-07-18T15:34:53.133Z",
        "publishedAt": "2026-07-20T15:34:53.133Z",
        "amount": 116700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100038-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000026"
      },
      {
        "rank": 39,
        "key": "ocds-h6vhtk-000027:award-39",
        "ocid": "ocds-h6vhtk-000027",
        "releaseId": "100039-2026",
        "awardId": "award-39",
        "title": "NHS England — Fleet Decarbonisation and Vehicle Maintenance Package 4",
        "buyer": "NHS England",
        "suppliers": [
          "Microsoft Ireland Operations Ltd"
        ],
        "supplierNations": [
          "Other/Unknown"
        ],
        "awardDate": "2026-06-18T15:34:53.133Z",
        "publishedAt": "2026-06-20T15:34:53.133Z",
        "amount": 115000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100039-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000027"
      },
      {
        "rank": 40,
        "key": "ocds-h6vhtk-000028:award-40",
        "ocid": "ocds-h6vhtk-000028",
        "releaseId": "100040-2026",
        "awardId": "award-40",
        "title": "Department for Environment Food and Rural Affairs — Enterprise Software Systems Licensing Package 5",
        "buyer": "Department for Environment Food and Rural Affairs",
        "suppliers": [
          "Atos IT Services UK Limited",
          "PA Consulting Services Ltd"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-05-19T15:34:53.133Z",
        "publishedAt": "2026-05-21T15:34:53.133Z",
        "amount": 113100000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100040-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000028"
      },
      {
        "rank": 41,
        "key": "ocds-h6vhtk-000029:award-41",
        "ocid": "ocds-h6vhtk-000029",
        "releaseId": "100041-2026",
        "awardId": "award-41",
        "title": "Department for Business and Trade — Facilities and Secure Property Management Package 5",
        "buyer": "Department for Business and Trade",
        "suppliers": [
          "Arup Group Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-04-19T15:34:53.133Z",
        "publishedAt": "2026-04-21T15:34:53.133Z",
        "amount": 112000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100041-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000029"
      },
      {
        "rank": 42,
        "key": "ocds-h6vhtk-00002a:award-42",
        "ocid": "ocds-h6vhtk-00002a",
        "releaseId": "100042-2026",
        "awardId": "award-42",
        "title": "Department for Education — Cloud Infrastructure Integration and Support Package 5",
        "buyer": "Department for Education",
        "suppliers": [
          "Serco Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-03-20T15:34:53.133Z",
        "publishedAt": "2026-03-22T15:34:53.133Z",
        "amount": 110700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100042-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00002a"
      },
      {
        "rank": 43,
        "key": "ocds-h6vhtk-00002b:award-43",
        "ocid": "ocds-h6vhtk-00002b",
        "releaseId": "100043-2026",
        "awardId": "award-43",
        "title": "Home Office — Civil Infrastructure Engineering and Maintenance Package 5",
        "buyer": "Home Office",
        "suppliers": [
          "Mace Group Ltd"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-02-18T15:34:53.133Z",
        "publishedAt": "2026-02-20T15:34:53.133Z",
        "amount": 109200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100043-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00002b"
      },
      {
        "rank": 44,
        "key": "ocds-h6vhtk-00002c:award-44",
        "ocid": "ocds-h6vhtk-00002c",
        "releaseId": "100044-2026",
        "awardId": "award-44",
        "title": "Department for Work and Pensions — Clinical Diagnostics and Health Monitoring Package 5",
        "buyer": "Department for Work and Pensions",
        "suppliers": [
          "Atos IT Services UK Limited",
          "QinetiQ Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-01-19T15:34:53.133Z",
        "publishedAt": "2026-01-21T15:34:53.133Z",
        "amount": 107500000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award under urgent public interest",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100044-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00002c"
      },
      {
        "rank": 45,
        "key": "ocds-h6vhtk-00002d:award-45",
        "ocid": "ocds-h6vhtk-00002d",
        "releaseId": "100045-2026",
        "awardId": "award-45",
        "title": "Scottish Government — Digital Transformation Consultancy Services Package 5",
        "buyer": "Scottish Government",
        "suppliers": [
          "Alun Griffiths (Contractors) Ltd"
        ],
        "supplierNations": [
          "Wales"
        ],
        "awardDate": "2026-09-16T15:34:53.133Z",
        "publishedAt": "2026-09-18T15:34:53.133Z",
        "amount": 105600000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "works",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100045-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00002d"
      },
      {
        "rank": 46,
        "key": "ocds-h6vhtk-00002e:award-46",
        "ocid": "ocds-h6vhtk-00002e",
        "releaseId": "100046-2026",
        "awardId": "award-46",
        "title": "National Highways — Renewable Power Generation and Energy Efficiency Package 5",
        "buyer": "National Highways",
        "suppliers": [
          "Oracle Corporation UK Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-08-17T15:34:53.133Z",
        "publishedAt": "2026-08-19T15:34:53.133Z",
        "amount": 104500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100046-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00002e"
      },
      {
        "rank": 47,
        "key": "ocds-h6vhtk-00002f:award-47",
        "ocid": "ocds-h6vhtk-00002f",
        "releaseId": "100047-2026",
        "awardId": "award-47",
        "title": "High Speed Two (HS2) Limited — Cyber Security Monitoring and Incident Response Package 5",
        "buyer": "High Speed Two (HS2) Limited",
        "suppliers": [
          "Atos IT Services UK Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-07-18T15:34:53.133Z",
        "publishedAt": "2026-07-20T15:34:53.133Z",
        "amount": 103200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100047-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00002f"
      },
      {
        "rank": 48,
        "key": "ocds-h6vhtk-000030:award-48",
        "ocid": "ocds-h6vhtk-000030",
        "releaseId": "100048-2026",
        "awardId": "award-48",
        "title": "Ministry of Defence — Transport Network Telemetry and Sensor Systems Package 5",
        "buyer": "Ministry of Defence",
        "suppliers": [
          "Atos IT Services UK Limited",
          "WSP UK Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-06-18T15:34:53.133Z",
        "publishedAt": "2026-06-20T15:34:53.133Z",
        "amount": 101700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100048-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000030"
      },
      {
        "rank": 49,
        "key": "ocds-h6vhtk-000031:award-49",
        "ocid": "ocds-h6vhtk-000031",
        "releaseId": "100049-2026",
        "awardId": "award-49",
        "title": "Ministry of Justice — Fleet Decarbonisation and Vehicle Maintenance Package 5",
        "buyer": "Ministry of Justice",
        "suppliers": [
          "Sodexo Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-05-19T15:34:53.133Z",
        "publishedAt": "2026-05-21T15:34:53.133Z",
        "amount": 100000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100049-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000031"
      },
      {
        "rank": 50,
        "key": "ocds-h6vhtk-000032:award-50",
        "ocid": "ocds-h6vhtk-000032",
        "releaseId": "100050-2026",
        "awardId": "award-50",
        "title": "Foreign Commonwealth and Development Office — Enterprise Software Systems Licensing Package 6",
        "buyer": "Foreign Commonwealth and Development Office",
        "suppliers": [
          "Sir Robert McAlpine Ltd"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-04-19T15:34:53.133Z",
        "publishedAt": "2026-04-21T15:34:53.133Z",
        "amount": 98100000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100050-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000032"
      },
      {
        "rank": 51,
        "key": "ocds-h6vhtk-000033:award-51",
        "ocid": "ocds-h6vhtk-000033",
        "releaseId": "100051-2026",
        "awardId": "award-51",
        "title": "HM Revenue and Customs — Facilities and Secure Property Management Package 6",
        "buyer": "HM Revenue and Customs",
        "suppliers": [
          "BAE Systems Surface Ships Ltd"
        ],
        "supplierNations": [
          "Scotland"
        ],
        "awardDate": "2026-03-20T15:34:53.133Z",
        "publishedAt": "2026-03-22T15:34:53.133Z",
        "amount": 97000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100051-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000033"
      },
      {
        "rank": 52,
        "key": "ocds-h6vhtk-000034:award-52",
        "ocid": "ocds-h6vhtk-000034",
        "releaseId": "100052-2026",
        "awardId": "award-52",
        "title": "Welsh Government — Cloud Infrastructure Integration and Support Package 6",
        "buyer": "Welsh Government",
        "suppliers": [
          "Atos IT Services UK Limited",
          "McLaughlin & Harvey Ltd"
        ],
        "supplierNations": [
          "England",
          "Northern Ireland"
        ],
        "awardDate": "2026-02-18T15:34:53.133Z",
        "publishedAt": "2026-02-20T15:34:53.133Z",
        "amount": 95700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100052-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000034"
      },
      {
        "rank": 53,
        "key": "ocds-h6vhtk-000035:award-53",
        "ocid": "ocds-h6vhtk-000035",
        "releaseId": "100053-2026",
        "awardId": "award-53",
        "title": "Crown Commercial Service — Civil Infrastructure Engineering and Maintenance Package 6",
        "buyer": "Crown Commercial Service",
        "suppliers": [
          "Cisco International Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-01-19T15:34:53.133Z",
        "publishedAt": "2026-01-21T15:34:53.133Z",
        "amount": 94200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100053-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000035"
      },
      {
        "rank": 54,
        "key": "ocds-h6vhtk-000036:award-54",
        "ocid": "ocds-h6vhtk-000036",
        "releaseId": "100054-2026",
        "awardId": "award-54",
        "title": "Transport for London — Clinical Diagnostics and Health Monitoring Package 6",
        "buyer": "Transport for London",
        "suppliers": [
          "Jacobs U.K. Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-09-16T15:34:53.133Z",
        "publishedAt": "2026-09-18T15:34:53.133Z",
        "amount": 92500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100054-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000036"
      },
      {
        "rank": 55,
        "key": "ocds-h6vhtk-000037:award-55",
        "ocid": "ocds-h6vhtk-000037",
        "releaseId": "100055-2026",
        "awardId": "award-55",
        "title": "NHS England — Digital Transformation Consultancy Services Package 6",
        "buyer": "NHS England",
        "suppliers": [
          "Amey Community Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-08-17T15:34:53.133Z",
        "publishedAt": "2026-08-19T15:34:53.133Z",
        "amount": 90600000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award under urgent public interest",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100055-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000037"
      },
      {
        "rank": 56,
        "key": "ocds-h6vhtk-000038:award-56",
        "ocid": "ocds-h6vhtk-000038",
        "releaseId": "100056-2026",
        "awardId": "award-56",
        "title": "Department for Environment Food and Rural Affairs — Renewable Power Generation and Energy Efficiency Package 6",
        "buyer": "Department for Environment Food and Rural Affairs",
        "suppliers": [
          "Atos IT Services UK Limited",
          "Mitie Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-07-18T15:34:53.133Z",
        "publishedAt": "2026-07-20T15:34:53.133Z",
        "amount": 89500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100056-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000038"
      },
      {
        "rank": 57,
        "key": "ocds-h6vhtk-000039:award-57",
        "ocid": "ocds-h6vhtk-000039",
        "releaseId": "100057-2026",
        "awardId": "award-57",
        "title": "Department for Business and Trade — Cyber Security Monitoring and Incident Response Package 6",
        "buyer": "Department for Business and Trade",
        "suppliers": [
          "Turner & Townsend Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-06-18T15:34:53.133Z",
        "publishedAt": "2026-06-20T15:34:53.133Z",
        "amount": 88200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100057-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000039"
      },
      {
        "rank": 58,
        "key": "ocds-h6vhtk-00003a:award-58",
        "ocid": "ocds-h6vhtk-00003a",
        "releaseId": "100058-2026",
        "awardId": "award-58",
        "title": "Department for Education — Transport Network Telemetry and Sensor Systems Package 6",
        "buyer": "Department for Education",
        "suppliers": [
          "Robertson Group (Holdings) Ltd"
        ],
        "supplierNations": [
          "Scotland"
        ],
        "awardDate": "2026-05-19T15:34:53.133Z",
        "publishedAt": "2026-05-21T15:34:53.133Z",
        "amount": 86700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100058-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00003a"
      },
      {
        "rank": 59,
        "key": "ocds-h6vhtk-00003b:award-59",
        "ocid": "ocds-h6vhtk-00003b",
        "releaseId": "100059-2026",
        "awardId": "award-59",
        "title": "Home Office — Fleet Decarbonisation and Vehicle Maintenance Package 6",
        "buyer": "Home Office",
        "suppliers": [
          "Microsoft Ireland Operations Ltd"
        ],
        "supplierNations": [
          "Other/Unknown"
        ],
        "awardDate": "2026-04-19T15:34:53.133Z",
        "publishedAt": "2026-04-21T15:34:53.133Z",
        "amount": 85000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100059-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00003b"
      },
      {
        "rank": 60,
        "key": "ocds-h6vhtk-00003c:award-60",
        "ocid": "ocds-h6vhtk-00003c",
        "releaseId": "100060-2026",
        "awardId": "award-60",
        "title": "Department for Work and Pensions — Enterprise Software Systems Licensing Package 7",
        "buyer": "Department for Work and Pensions",
        "suppliers": [
          "Atos IT Services UK Limited",
          "PA Consulting Services Ltd"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-03-20T15:34:53.133Z",
        "publishedAt": "2026-03-22T15:34:53.133Z",
        "amount": 83100000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "works",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100060-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00003c"
      },
      {
        "rank": 61,
        "key": "ocds-h6vhtk-00003d:award-61",
        "ocid": "ocds-h6vhtk-00003d",
        "releaseId": "100061-2026",
        "awardId": "award-61",
        "title": "Scottish Government — Facilities and Secure Property Management Package 7",
        "buyer": "Scottish Government",
        "suppliers": [
          "Arup Group Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-02-18T15:34:53.133Z",
        "publishedAt": "2026-02-20T15:34:53.133Z",
        "amount": 82000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100061-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00003d"
      },
      {
        "rank": 62,
        "key": "ocds-h6vhtk-00003e:award-62",
        "ocid": "ocds-h6vhtk-00003e",
        "releaseId": "100062-2026",
        "awardId": "award-62",
        "title": "National Highways — Cloud Infrastructure Integration and Support Package 7",
        "buyer": "National Highways",
        "suppliers": [
          "Serco Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-01-19T15:34:53.133Z",
        "publishedAt": "2026-01-21T15:34:53.133Z",
        "amount": 80700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100062-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00003e"
      },
      {
        "rank": 63,
        "key": "ocds-h6vhtk-00003f:award-63",
        "ocid": "ocds-h6vhtk-00003f",
        "releaseId": "100063-2026",
        "awardId": "award-63",
        "title": "High Speed Two (HS2) Limited — Civil Infrastructure Engineering and Maintenance Package 7",
        "buyer": "High Speed Two (HS2) Limited",
        "suppliers": [
          "Mace Group Ltd"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-09-16T15:34:53.133Z",
        "publishedAt": "2026-09-18T15:34:53.133Z",
        "amount": 79200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100063-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00003f"
      },
      {
        "rank": 64,
        "key": "ocds-h6vhtk-000040:award-64",
        "ocid": "ocds-h6vhtk-000040",
        "releaseId": "100064-2026",
        "awardId": "award-64",
        "title": "Ministry of Defence — Clinical Diagnostics and Health Monitoring Package 7",
        "buyer": "Ministry of Defence",
        "suppliers": [
          "Atos IT Services UK Limited",
          "QinetiQ Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-08-17T15:34:53.133Z",
        "publishedAt": "2026-08-19T15:34:53.133Z",
        "amount": 77500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100064-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000040"
      },
      {
        "rank": 65,
        "key": "ocds-h6vhtk-000041:award-65",
        "ocid": "ocds-h6vhtk-000041",
        "releaseId": "100065-2026",
        "awardId": "award-65",
        "title": "Ministry of Justice — Digital Transformation Consultancy Services Package 7",
        "buyer": "Ministry of Justice",
        "suppliers": [
          "Alun Griffiths (Contractors) Ltd"
        ],
        "supplierNations": [
          "Wales"
        ],
        "awardDate": "2026-07-18T15:34:53.133Z",
        "publishedAt": "2026-07-20T15:34:53.133Z",
        "amount": 75600000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100065-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000041"
      },
      {
        "rank": 66,
        "key": "ocds-h6vhtk-000042:award-66",
        "ocid": "ocds-h6vhtk-000042",
        "releaseId": "100066-2026",
        "awardId": "award-66",
        "title": "Foreign Commonwealth and Development Office — Renewable Power Generation and Energy Efficiency Package 7",
        "buyer": "Foreign Commonwealth and Development Office",
        "suppliers": [
          "Oracle Corporation UK Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-06-18T15:34:53.133Z",
        "publishedAt": "2026-06-20T15:34:53.133Z",
        "amount": 74500000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award under urgent public interest",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100066-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000042"
      },
      {
        "rank": 67,
        "key": "ocds-h6vhtk-000043:award-67",
        "ocid": "ocds-h6vhtk-000043",
        "releaseId": "100067-2026",
        "awardId": "award-67",
        "title": "HM Revenue and Customs — Cyber Security Monitoring and Incident Response Package 7",
        "buyer": "HM Revenue and Customs",
        "suppliers": [
          "Atos IT Services UK Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-05-19T15:34:53.133Z",
        "publishedAt": "2026-05-21T15:34:53.133Z",
        "amount": 73200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100067-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000043"
      },
      {
        "rank": 68,
        "key": "ocds-h6vhtk-000044:award-68",
        "ocid": "ocds-h6vhtk-000044",
        "releaseId": "100068-2026",
        "awardId": "award-68",
        "title": "Welsh Government — Transport Network Telemetry and Sensor Systems Package 7",
        "buyer": "Welsh Government",
        "suppliers": [
          "Atos IT Services UK Limited",
          "WSP UK Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-04-19T15:34:53.133Z",
        "publishedAt": "2026-04-21T15:34:53.133Z",
        "amount": 71700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100068-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000044"
      },
      {
        "rank": 69,
        "key": "ocds-h6vhtk-000045:award-69",
        "ocid": "ocds-h6vhtk-000045",
        "releaseId": "100069-2026",
        "awardId": "award-69",
        "title": "Crown Commercial Service — Fleet Decarbonisation and Vehicle Maintenance Package 7",
        "buyer": "Crown Commercial Service",
        "suppliers": [
          "Sodexo Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-03-20T15:34:53.133Z",
        "publishedAt": "2026-03-22T15:34:53.133Z",
        "amount": 70000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100069-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000045"
      },
      {
        "rank": 70,
        "key": "ocds-h6vhtk-000046:award-70",
        "ocid": "ocds-h6vhtk-000046",
        "releaseId": "100070-2026",
        "awardId": "award-70",
        "title": "Transport for London — Enterprise Software Systems Licensing Package 8",
        "buyer": "Transport for London",
        "suppliers": [
          "Sir Robert McAlpine Ltd"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-02-18T15:34:53.133Z",
        "publishedAt": "2026-02-20T15:34:53.133Z",
        "amount": 68100000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100070-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000046"
      },
      {
        "rank": 71,
        "key": "ocds-h6vhtk-000047:award-71",
        "ocid": "ocds-h6vhtk-000047",
        "releaseId": "100071-2026",
        "awardId": "award-71",
        "title": "NHS England — Facilities and Secure Property Management Package 8",
        "buyer": "NHS England",
        "suppliers": [
          "BAE Systems Surface Ships Ltd"
        ],
        "supplierNations": [
          "Scotland"
        ],
        "awardDate": "2026-01-19T15:34:53.133Z",
        "publishedAt": "2026-01-21T15:34:53.133Z",
        "amount": 67000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100071-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000047"
      },
      {
        "rank": 72,
        "key": "ocds-h6vhtk-000048:award-72",
        "ocid": "ocds-h6vhtk-000048",
        "releaseId": "100072-2026",
        "awardId": "award-72",
        "title": "Department for Environment Food and Rural Affairs — Cloud Infrastructure Integration and Support Package 8",
        "buyer": "Department for Environment Food and Rural Affairs",
        "suppliers": [
          "Atos IT Services UK Limited",
          "McLaughlin & Harvey Ltd"
        ],
        "supplierNations": [
          "England",
          "Northern Ireland"
        ],
        "awardDate": "2026-09-16T15:34:53.133Z",
        "publishedAt": "2026-09-18T15:34:53.133Z",
        "amount": 65700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100072-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000048"
      },
      {
        "rank": 73,
        "key": "ocds-h6vhtk-000049:award-73",
        "ocid": "ocds-h6vhtk-000049",
        "releaseId": "100073-2026",
        "awardId": "award-73",
        "title": "Department for Business and Trade — Civil Infrastructure Engineering and Maintenance Package 8",
        "buyer": "Department for Business and Trade",
        "suppliers": [
          "Cisco International Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-08-17T15:34:53.133Z",
        "publishedAt": "2026-08-19T15:34:53.133Z",
        "amount": 64200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100073-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000049"
      },
      {
        "rank": 74,
        "key": "ocds-h6vhtk-00004a:award-74",
        "ocid": "ocds-h6vhtk-00004a",
        "releaseId": "100074-2026",
        "awardId": "award-74",
        "title": "Department for Education — Clinical Diagnostics and Health Monitoring Package 8",
        "buyer": "Department for Education",
        "suppliers": [
          "Jacobs U.K. Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-07-18T15:34:53.133Z",
        "publishedAt": "2026-07-20T15:34:53.133Z",
        "amount": 62500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100074-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00004a"
      },
      {
        "rank": 75,
        "key": "ocds-h6vhtk-00004b:award-75",
        "ocid": "ocds-h6vhtk-00004b",
        "releaseId": "100075-2026",
        "awardId": "award-75",
        "title": "Home Office — Digital Transformation Consultancy Services Package 8",
        "buyer": "Home Office",
        "suppliers": [
          "Amey Community Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-06-18T15:34:53.133Z",
        "publishedAt": "2026-06-20T15:34:53.133Z",
        "amount": 60600000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "works",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100075-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00004b"
      },
      {
        "rank": 76,
        "key": "ocds-h6vhtk-00004c:award-76",
        "ocid": "ocds-h6vhtk-00004c",
        "releaseId": "100076-2026",
        "awardId": "award-76",
        "title": "Department for Work and Pensions — Renewable Power Generation and Energy Efficiency Package 8",
        "buyer": "Department for Work and Pensions",
        "suppliers": [
          "Atos IT Services UK Limited",
          "Mitie Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-05-19T15:34:53.133Z",
        "publishedAt": "2026-05-21T15:34:53.133Z",
        "amount": 59500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100076-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00004c"
      },
      {
        "rank": 77,
        "key": "ocds-h6vhtk-00004d:award-77",
        "ocid": "ocds-h6vhtk-00004d",
        "releaseId": "100077-2026",
        "awardId": "award-77",
        "title": "Scottish Government — Cyber Security Monitoring and Incident Response Package 8",
        "buyer": "Scottish Government",
        "suppliers": [
          "Turner & Townsend Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-04-19T15:34:53.133Z",
        "publishedAt": "2026-04-21T15:34:53.133Z",
        "amount": 58200000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award under urgent public interest",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100077-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00004d"
      },
      {
        "rank": 78,
        "key": "ocds-h6vhtk-00004e:award-78",
        "ocid": "ocds-h6vhtk-00004e",
        "releaseId": "100078-2026",
        "awardId": "award-78",
        "title": "National Highways — Transport Network Telemetry and Sensor Systems Package 8",
        "buyer": "National Highways",
        "suppliers": [
          "Robertson Group (Holdings) Ltd"
        ],
        "supplierNations": [
          "Scotland"
        ],
        "awardDate": "2026-03-20T15:34:53.133Z",
        "publishedAt": "2026-03-22T15:34:53.133Z",
        "amount": 56700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100078-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00004e"
      },
      {
        "rank": 79,
        "key": "ocds-h6vhtk-00004f:award-79",
        "ocid": "ocds-h6vhtk-00004f",
        "releaseId": "100079-2026",
        "awardId": "award-79",
        "title": "High Speed Two (HS2) Limited — Fleet Decarbonisation and Vehicle Maintenance Package 8",
        "buyer": "High Speed Two (HS2) Limited",
        "suppliers": [
          "Microsoft Ireland Operations Ltd"
        ],
        "supplierNations": [
          "Other/Unknown"
        ],
        "awardDate": "2026-02-18T15:34:53.133Z",
        "publishedAt": "2026-02-20T15:34:53.133Z",
        "amount": 55000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100079-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00004f"
      },
      {
        "rank": 80,
        "key": "ocds-h6vhtk-000050:award-80",
        "ocid": "ocds-h6vhtk-000050",
        "releaseId": "100080-2026",
        "awardId": "award-80",
        "title": "Ministry of Defence — Enterprise Software Systems Licensing Package 9",
        "buyer": "Ministry of Defence",
        "suppliers": [
          "Atos IT Services UK Limited",
          "PA Consulting Services Ltd"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-01-19T15:34:53.133Z",
        "publishedAt": "2026-01-21T15:34:53.133Z",
        "amount": 53100000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100080-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000050"
      },
      {
        "rank": 81,
        "key": "ocds-h6vhtk-000051:award-81",
        "ocid": "ocds-h6vhtk-000051",
        "releaseId": "100081-2026",
        "awardId": "award-81",
        "title": "Ministry of Justice — Facilities and Secure Property Management Package 9",
        "buyer": "Ministry of Justice",
        "suppliers": [
          "Arup Group Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-09-16T15:34:53.133Z",
        "publishedAt": "2026-09-18T15:34:53.133Z",
        "amount": 52000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100081-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000051"
      },
      {
        "rank": 82,
        "key": "ocds-h6vhtk-000052:award-82",
        "ocid": "ocds-h6vhtk-000052",
        "releaseId": "100082-2026",
        "awardId": "award-82",
        "title": "Foreign Commonwealth and Development Office — Cloud Infrastructure Integration and Support Package 9",
        "buyer": "Foreign Commonwealth and Development Office",
        "suppliers": [
          "Serco Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-08-17T15:34:53.133Z",
        "publishedAt": "2026-08-19T15:34:53.133Z",
        "amount": 50700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100082-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000052"
      },
      {
        "rank": 83,
        "key": "ocds-h6vhtk-000053:award-83",
        "ocid": "ocds-h6vhtk-000053",
        "releaseId": "100083-2026",
        "awardId": "award-83",
        "title": "HM Revenue and Customs — Civil Infrastructure Engineering and Maintenance Package 9",
        "buyer": "HM Revenue and Customs",
        "suppliers": [
          "Mace Group Ltd"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-07-18T15:34:53.133Z",
        "publishedAt": "2026-07-20T15:34:53.133Z",
        "amount": 49200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100083-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000053"
      },
      {
        "rank": 84,
        "key": "ocds-h6vhtk-000054:award-84",
        "ocid": "ocds-h6vhtk-000054",
        "releaseId": "100084-2026",
        "awardId": "award-84",
        "title": "Welsh Government — Clinical Diagnostics and Health Monitoring Package 9",
        "buyer": "Welsh Government",
        "suppliers": [
          "Atos IT Services UK Limited",
          "QinetiQ Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-06-18T15:34:53.133Z",
        "publishedAt": "2026-06-20T15:34:53.133Z",
        "amount": 47500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100084-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000054"
      },
      {
        "rank": 85,
        "key": "ocds-h6vhtk-000055:award-85",
        "ocid": "ocds-h6vhtk-000055",
        "releaseId": "100085-2026",
        "awardId": "award-85",
        "title": "Crown Commercial Service — Digital Transformation Consultancy Services Package 9",
        "buyer": "Crown Commercial Service",
        "suppliers": [
          "Alun Griffiths (Contractors) Ltd"
        ],
        "supplierNations": [
          "Wales"
        ],
        "awardDate": "2026-05-19T15:34:53.133Z",
        "publishedAt": "2026-05-21T15:34:53.133Z",
        "amount": 45600000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100085-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000055"
      },
      {
        "rank": 86,
        "key": "ocds-h6vhtk-000056:award-86",
        "ocid": "ocds-h6vhtk-000056",
        "releaseId": "100086-2026",
        "awardId": "award-86",
        "title": "Transport for London — Renewable Power Generation and Energy Efficiency Package 9",
        "buyer": "Transport for London",
        "suppliers": [
          "Oracle Corporation UK Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-04-19T15:34:53.133Z",
        "publishedAt": "2026-04-21T15:34:53.133Z",
        "amount": 44500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100086-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000056"
      },
      {
        "rank": 87,
        "key": "ocds-h6vhtk-000057:award-87",
        "ocid": "ocds-h6vhtk-000057",
        "releaseId": "100087-2026",
        "awardId": "award-87",
        "title": "NHS England — Cyber Security Monitoring and Incident Response Package 9",
        "buyer": "NHS England",
        "suppliers": [
          "Atos IT Services UK Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-03-20T15:34:53.133Z",
        "publishedAt": "2026-03-22T15:34:53.133Z",
        "amount": 43200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100087-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000057"
      },
      {
        "rank": 88,
        "key": "ocds-h6vhtk-000058:award-88",
        "ocid": "ocds-h6vhtk-000058",
        "releaseId": "100088-2026",
        "awardId": "award-88",
        "title": "Department for Environment Food and Rural Affairs — Transport Network Telemetry and Sensor Systems Package 9",
        "buyer": "Department for Environment Food and Rural Affairs",
        "suppliers": [
          "Atos IT Services UK Limited",
          "WSP UK Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-02-18T15:34:53.133Z",
        "publishedAt": "2026-02-20T15:34:53.133Z",
        "amount": 41700000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award under urgent public interest",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100088-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000058"
      },
      {
        "rank": 89,
        "key": "ocds-h6vhtk-000059:award-89",
        "ocid": "ocds-h6vhtk-000059",
        "releaseId": "100089-2026",
        "awardId": "award-89",
        "title": "Department for Business and Trade — Fleet Decarbonisation and Vehicle Maintenance Package 9",
        "buyer": "Department for Business and Trade",
        "suppliers": [
          "Sodexo Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-01-19T15:34:53.133Z",
        "publishedAt": "2026-01-21T15:34:53.133Z",
        "amount": 40000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100089-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000059"
      },
      {
        "rank": 90,
        "key": "ocds-h6vhtk-00005a:award-90",
        "ocid": "ocds-h6vhtk-00005a",
        "releaseId": "100090-2026",
        "awardId": "award-90",
        "title": "Department for Education — Enterprise Software Systems Licensing Package 10",
        "buyer": "Department for Education",
        "suppliers": [
          "Sir Robert McAlpine Ltd"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-09-16T15:34:53.133Z",
        "publishedAt": "2026-09-18T15:34:53.133Z",
        "amount": 38100000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "works",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100090-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00005a"
      },
      {
        "rank": 91,
        "key": "ocds-h6vhtk-00005b:award-91",
        "ocid": "ocds-h6vhtk-00005b",
        "releaseId": "100091-2026",
        "awardId": "award-91",
        "title": "Home Office — Facilities and Secure Property Management Package 10",
        "buyer": "Home Office",
        "suppliers": [
          "BAE Systems Surface Ships Ltd"
        ],
        "supplierNations": [
          "Scotland"
        ],
        "awardDate": "2026-08-17T15:34:53.133Z",
        "publishedAt": "2026-08-19T15:34:53.133Z",
        "amount": 37000000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100091-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00005b"
      },
      {
        "rank": 92,
        "key": "ocds-h6vhtk-00005c:award-92",
        "ocid": "ocds-h6vhtk-00005c",
        "releaseId": "100092-2026",
        "awardId": "award-92",
        "title": "Department for Work and Pensions — Cloud Infrastructure Integration and Support Package 10",
        "buyer": "Department for Work and Pensions",
        "suppliers": [
          "Atos IT Services UK Limited",
          "McLaughlin & Harvey Ltd"
        ],
        "supplierNations": [
          "England",
          "Northern Ireland"
        ],
        "awardDate": "2026-07-18T15:34:53.133Z",
        "publishedAt": "2026-07-20T15:34:53.133Z",
        "amount": 35700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100092-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00005c"
      },
      {
        "rank": 93,
        "key": "ocds-h6vhtk-00005d:award-93",
        "ocid": "ocds-h6vhtk-00005d",
        "releaseId": "100093-2026",
        "awardId": "award-93",
        "title": "Scottish Government — Civil Infrastructure Engineering and Maintenance Package 10",
        "buyer": "Scottish Government",
        "suppliers": [
          "Cisco International Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-06-18T15:34:53.133Z",
        "publishedAt": "2026-06-20T15:34:53.133Z",
        "amount": 34200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100093-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00005d"
      },
      {
        "rank": 94,
        "key": "ocds-h6vhtk-00005e:award-94",
        "ocid": "ocds-h6vhtk-00005e",
        "releaseId": "100094-2026",
        "awardId": "award-94",
        "title": "National Highways — Clinical Diagnostics and Health Monitoring Package 10",
        "buyer": "National Highways",
        "suppliers": [
          "Jacobs U.K. Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-05-19T15:34:53.133Z",
        "publishedAt": "2026-05-21T15:34:53.133Z",
        "amount": 32500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100094-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00005e"
      },
      {
        "rank": 95,
        "key": "ocds-h6vhtk-00005f:award-95",
        "ocid": "ocds-h6vhtk-00005f",
        "releaseId": "100095-2026",
        "awardId": "award-95",
        "title": "High Speed Two (HS2) Limited — Digital Transformation Consultancy Services Package 10",
        "buyer": "High Speed Two (HS2) Limited",
        "suppliers": [
          "Amey Community Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-04-19T15:34:53.133Z",
        "publishedAt": "2026-04-21T15:34:53.133Z",
        "amount": 30600000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100095-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-00005f"
      },
      {
        "rank": 96,
        "key": "ocds-h6vhtk-000060:award-96",
        "ocid": "ocds-h6vhtk-000060",
        "releaseId": "100096-2026",
        "awardId": "award-96",
        "title": "Ministry of Defence — Renewable Power Generation and Energy Efficiency Package 10",
        "buyer": "Ministry of Defence",
        "suppliers": [
          "Atos IT Services UK Limited",
          "Mitie Limited"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-03-20T15:34:53.133Z",
        "publishedAt": "2026-03-22T15:34:53.133Z",
        "amount": 29500000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Framework call-off competition",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100096-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000060"
      },
      {
        "rank": 97,
        "key": "ocds-h6vhtk-000061:award-97",
        "ocid": "ocds-h6vhtk-000061",
        "releaseId": "100097-2026",
        "awardId": "award-97",
        "title": "Ministry of Justice — Cyber Security Monitoring and Incident Response Package 10",
        "buyer": "Ministry of Justice",
        "suppliers": [
          "Turner & Townsend Limited"
        ],
        "supplierNations": [
          "England"
        ],
        "awardDate": "2026-02-18T15:34:53.133Z",
        "publishedAt": "2026-02-20T15:34:53.133Z",
        "amount": 28200000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100097-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000061"
      },
      {
        "rank": 98,
        "key": "ocds-h6vhtk-000062:award-98",
        "ocid": "ocds-h6vhtk-000062",
        "releaseId": "100098-2026",
        "awardId": "award-98",
        "title": "Foreign Commonwealth and Development Office — Transport Network Telemetry and Sensor Systems Package 10",
        "buyer": "Foreign Commonwealth and Development Office",
        "suppliers": [
          "Robertson Group (Holdings) Ltd"
        ],
        "supplierNations": [
          "Scotland"
        ],
        "awardDate": "2026-01-19T15:34:53.133Z",
        "publishedAt": "2026-01-21T15:34:53.133Z",
        "amount": 26700000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "services",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100098-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000062"
      },
      {
        "rank": 99,
        "key": "ocds-h6vhtk-000063:award-99",
        "ocid": "ocds-h6vhtk-000063",
        "releaseId": "100099-2026",
        "awardId": "award-99",
        "title": "HM Revenue and Customs — Fleet Decarbonisation and Vehicle Maintenance Package 10",
        "buyer": "HM Revenue and Customs",
        "suppliers": [
          "Microsoft Ireland Operations Ltd"
        ],
        "supplierNations": [
          "Other/Unknown"
        ],
        "awardDate": "2026-09-16T15:34:53.133Z",
        "publishedAt": "2026-09-18T15:34:53.133Z",
        "amount": 25000000,
        "currency": "GBP",
        "procurementMethod": "direct",
        "procurementMethodDetails": "Direct award under urgent public interest",
        "mainProcurementCategory": "supplies",
        "framework": true,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100099-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000063"
      },
      {
        "rank": 100,
        "key": "ocds-h6vhtk-000064:award-100",
        "ocid": "ocds-h6vhtk-000064",
        "releaseId": "100100-2026",
        "awardId": "award-100",
        "title": "Welsh Government — Enterprise Software Systems Licensing Package 11",
        "buyer": "Welsh Government",
        "suppliers": [
          "Atos IT Services UK Limited",
          "PA Consulting Services Ltd"
        ],
        "supplierNations": [
          "England",
          "England"
        ],
        "awardDate": "2026-08-17T15:34:53.133Z",
        "publishedAt": "2026-08-19T15:34:53.133Z",
        "amount": 23100000,
        "currency": "GBP",
        "procurementMethod": "open",
        "procurementMethodDetails": "Open procedure under Public Contracts Regulations",
        "mainProcurementCategory": "works",
        "framework": false,
        "noticeUrl": "https://www.find-tender.service.gov.uk/Notice/100100-2026",
        "procurementUrl": "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000064"
      }
    ],
    "supplierConcentration": [
      {
        "name": "Atos IT Services UK Limited",
        "awardCount": 24,
        "disclosedValue": 1157800000,
        "nation": "England"
      },
      {
        "name": "Capgemini UK plc",
        "awardCount": 2,
        "disclosedValue": 602500000,
        "nation": "England"
      },
      {
        "name": "Babcock Marine Ltd",
        "awardCount": 1,
        "disclosedValue": 495000000,
        "nation": "Scotland"
      },
      {
        "name": "Kainos Software Limited",
        "awardCount": 2,
        "disclosedValue": 487500000,
        "nation": "Northern Ireland"
      },
      {
        "name": "Arup Group Limited",
        "awardCount": 4,
        "disclosedValue": 388000000,
        "nation": "England"
      },
      {
        "name": "Serco Limited",
        "awardCount": 4,
        "disclosedValue": 382800000,
        "nation": "England"
      },
      {
        "name": "Mace Group Ltd",
        "awardCount": 4,
        "disclosedValue": 376800000,
        "nation": "England"
      },
      {
        "name": "Alun Griffiths (Contractors) Ltd",
        "awardCount": 4,
        "disclosedValue": 362400000,
        "nation": "Wales"
      },
      {
        "name": "Oracle Corporation UK Limited",
        "awardCount": 4,
        "disclosedValue": 358000000,
        "nation": "England"
      },
      {
        "name": "Sodexo Limited",
        "awardCount": 4,
        "disclosedValue": 340000000,
        "nation": "England"
      },
      {
        "name": "Balfour Beatty Group Ltd",
        "awardCount": 1,
        "disclosedValue": 337500000,
        "nation": "England"
      },
      {
        "name": "Costain Group PLC",
        "awardCount": 1,
        "disclosedValue": 337500000,
        "nation": "England"
      },
      {
        "name": "Sir Robert McAlpine Ltd",
        "awardCount": 4,
        "disclosedValue": 332400000,
        "nation": "England"
      },
      {
        "name": "BAE Systems Surface Ships Ltd",
        "awardCount": 4,
        "disclosedValue": 328000000,
        "nation": "Scotland"
      },
      {
        "name": "IBM United Kingdom Limited",
        "awardCount": 1,
        "disclosedValue": 320000000,
        "nation": "England"
      },
      {
        "name": "Cisco International Limited",
        "awardCount": 4,
        "disclosedValue": 316800000,
        "nation": "England"
      },
      {
        "name": "Jacobs U.K. Limited",
        "awardCount": 4,
        "disclosedValue": 310000000,
        "nation": "England"
      },
      {
        "name": "Amey Community Limited",
        "awardCount": 4,
        "disclosedValue": 302400000,
        "nation": "England"
      },
      {
        "name": "Turner & Townsend Limited",
        "awardCount": 4,
        "disclosedValue": 292800000,
        "nation": "England"
      },
      {
        "name": "Robertson Group (Holdings) Ltd",
        "awardCount": 4,
        "disclosedValue": 286800000,
        "nation": "Scotland"
      },
      {
        "name": "Microsoft Ireland Operations Ltd",
        "awardCount": 4,
        "disclosedValue": 280000000,
        "nation": "Other/Unknown"
      },
      {
        "name": "Accenture UK Limited",
        "awardCount": 1,
        "disclosedValue": 270000000,
        "nation": "England"
      },
      {
        "name": "Palantir Technologies UK Ltd",
        "awardCount": 1,
        "disclosedValue": 270000000,
        "nation": "England"
      },
      {
        "name": "Morgan Sindall Construction & Infrastructure Ltd",
        "awardCount": 1,
        "disclosedValue": 250000000,
        "nation": "Wales"
      },
      {
        "name": "Airbus Defence and Space Ltd",
        "awardCount": 1,
        "disclosedValue": 235000000,
        "nation": "England"
      },
      {
        "name": "First Rail Holdings Ltd",
        "awardCount": 1,
        "disclosedValue": 215000000,
        "nation": "England"
      },
      {
        "name": "Keolis UK Ltd",
        "awardCount": 1,
        "disclosedValue": 215000000,
        "nation": "Wales"
      },
      {
        "name": "Amazon Web Services EMEA SARL",
        "awardCount": 1,
        "disclosedValue": 192500000,
        "nation": "Other/Unknown"
      },
      {
        "name": "Motorola Solutions UK Limited",
        "awardCount": 1,
        "disclosedValue": 185000000,
        "nation": "England"
      },
      {
        "name": "QinetiQ Limited",
        "awardCount": 4,
        "disclosedValue": 185000000,
        "nation": "England"
      },
      {
        "name": "Alstom Transport UK Ltd",
        "awardCount": 1,
        "disclosedValue": 180000000,
        "nation": "England"
      },
      {
        "name": "VolkerFitzpatrick Ltd",
        "awardCount": 1,
        "disclosedValue": 180000000,
        "nation": "England"
      },
      {
        "name": "National Grid Electricity Transmission plc",
        "awardCount": 1,
        "disclosedValue": 175000000,
        "nation": "England"
      },
      {
        "name": "WSP UK Limited",
        "awardCount": 4,
        "disclosedValue": 173400000,
        "nation": "England"
      },
      {
        "name": "McLaughlin & Harvey Ltd",
        "awardCount": 4,
        "disclosedValue": 161400000,
        "nation": "Northern Ireland"
      },
      {
        "name": "Mitie Limited",
        "awardCount": 4,
        "disclosedValue": 149000000,
        "nation": "England"
      },
      {
        "name": "Scottish Power Energy Networks",
        "awardCount": 1,
        "disclosedValue": 147500000,
        "nation": "Scotland"
      },
      {
        "name": "SSE Energy Solutions Ltd",
        "awardCount": 1,
        "disclosedValue": 147500000,
        "nation": "Scotland"
      },
      {
        "name": "Fujitsu Services Limited",
        "awardCount": 1,
        "disclosedValue": 137500000,
        "nation": "England"
      },
      {
        "name": "Leidos Innovations UK Ltd",
        "awardCount": 1,
        "disclosedValue": 137500000,
        "nation": "England"
      },
      {
        "name": "PA Consulting Services Ltd",
        "awardCount": 4,
        "disclosedValue": 136200000,
        "nation": "England"
      },
      {
        "name": "Kier Construction Limited",
        "awardCount": 1,
        "disclosedValue": 110000000,
        "nation": "England"
      },
      {
        "name": "Willmott Dixon Construction Limited",
        "awardCount": 1,
        "disclosedValue": 110000000,
        "nation": "England"
      },
      {
        "name": "CH2M HILL United Kingdom",
        "awardCount": 1,
        "disclosedValue": 105000000,
        "nation": "England"
      },
      {
        "name": "Mott MacDonald Limited",
        "awardCount": 1,
        "disclosedValue": 105000000,
        "nation": "England"
      },
      {
        "name": "Farrans Construction",
        "awardCount": 1,
        "disclosedValue": 97500000,
        "nation": "Northern Ireland"
      },
      {
        "name": "Graham Construction Ltd",
        "awardCount": 1,
        "disclosedValue": 97500000,
        "nation": "Northern Ireland"
      },
      {
        "name": "Computacenter (UK) Ltd",
        "awardCount": 1,
        "disclosedValue": 82500000,
        "nation": "England"
      },
      {
        "name": "Softcat plc",
        "awardCount": 1,
        "disclosedValue": 82500000,
        "nation": "England"
      },
      {
        "name": "Deloitte LLP",
        "awardCount": 1,
        "disclosedValue": 77500000,
        "nation": "England"
      },
      {
        "name": "Johnson & Johnson Medical Ltd",
        "awardCount": 1,
        "disclosedValue": 74000000,
        "nation": "Scotland"
      },
      {
        "name": "Medtronic Limited",
        "awardCount": 1,
        "disclosedValue": 74000000,
        "nation": "England"
      }
    ],
    "dataQuality": {
      "pagesFetched": 28,
      "requestsMade": 28,
      "releasesSeen": 1420,
      "awardsSeen": 890,
      "validComparableAwards": 100,
      "excludedMissingValue": 120,
      "excludedNonGbp": 18,
      "excludedMissingBuyer": 0,
      "excludedMissingSupplier": 0,
      "excludedMalformed": 0,
      "duplicatesRemoved": 14
    },
    "caveats": [
      "Values are the amounts disclosed in Find a Tender award releases, not invoices or confirmed lifetime public expenditure.",
      "Framework and multi-supplier awards can state maximum or estimated values that may never be fully spent.",
      "The ranking covers comparable GBP awards updated in the stated window; missing, redacted and non-GBP values are excluded.",
      "A large award is not evidence of waste, fraud or poor value. The source notice and procurement context must be examined.",
      "Find a Tender is the central digital platform, but publication coverage and notice quality still depend on contracting authorities."
    ],
    "evidencePolicy": {
      "rankingMeasure": "disclosed award value excluding VAT where supplied",
      "actualSpendClaim": false,
      "wasteClaim": false,
      "fraudClaim": false,
      "savingClaim": false,
      "supplierAllocationMethod": "equal allocation across named suppliers for concentration analysis only",
      "comparisonCurrency": "GBP",
      "requiredAwardCount": 100
    },
    "__observation": {
      "status": "current",
      "period": "24 Sept 2026 to 1 Oct 2026",
      "observedAt": "2026-10-01T15:34:52.133Z",
      "checkedAt": "2026-10-01T15:34:53.133Z",
      "maxAgeHours": 72,
      "maxAgeDays": 3
    }
  }
};
