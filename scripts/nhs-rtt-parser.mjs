const MONTHS = Object.freeze({
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
});

const MONTH_ALIASES = Object.freeze({
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
});

const TREATMENT_FUNCTIONS = Object.freeze([
  "General Surgery Service",
  "Urology Service",
  "Trauma and Orthopaedic Service",
  "Ear Nose and Throat Service",
  "Ophthalmology Service",
  "Oral Surgery Service",
  "Neurosurgical Service",
  "Plastic Surgery Service",
  "Cardiothoracic Surgery Service",
  "General Internal Medicine Service",
  "Gastroenterology Service",
  "Cardiology Service",
  "Dermatology Service",
  "Respiratory Medicine Service",
  "Neurology Service",
  "Rheumatology Service",
  "Elderly Medicine Service",
  "Gynaecology Service",
  "Other - Medical Services",
  "Other - Mental Health Services",
  "Other - Paediatric Services",
  "Other - Surgical Services",
  "Other - Other Services",
]);

function decodeHtml(value) {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/&rsquo;|&#8217;|&#39;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function anchors(html) {
  return [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(
    (match) => ({ href: match[1], text: decodeHtml(match[2]) })
  );
}

function annualPageRank(link) {
  const match =
    link.href.match(/rtt-data-(\d{4})-(\d{2})/i) ??
    link.text.match(/\b(20\d{2})-(\d{2})\b/);
  if (!match) return Number.NEGATIVE_INFINITY;
  return Number(match[1]) * 100 + Number(match[2]);
}

function releaseRank(link) {
  const textMatch = link.text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i
  );
  if (textMatch) {
    const month = MONTH_ALIASES[textMatch[1].toLowerCase()];
    return month === undefined
      ? Number.NEGATIVE_INFINITY
      : Date.UTC(Number(textMatch[2]), month, 1);
  }

  const hrefMatch = decodeURIComponent(link.href).match(
    /(?:^|[/_-])(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{2})(?=[-_.])/i
  );
  if (!hrefMatch) return Number.NEGATIVE_INFINITY;
  const month = MONTH_ALIASES[hrefMatch[1].toLowerCase()];
  return month === undefined
    ? Number.NEGATIVE_INFINITY
    : Date.UTC(2000 + Number(hrefMatch[2]), month, 1);
}

function discoverRttDataPageUrl(html, landingUrl) {
  const candidates = anchors(html).filter(
    (link) =>
      /rtt-data-\d{4}-\d{2}\/?(?:[#?].*)?$/i.test(link.href) ||
      /\b20\d{2}-\d{2}\s+RTT waiting times data\b/i.test(link.text)
  );
  if (candidates.length === 0) {
    throw new Error("NHS RTT landing page did not expose a current annual data page");
  }
  candidates.sort((left, right) => annualPageRank(right) - annualPageRank(left));
  if (!Number.isFinite(annualPageRank(candidates[0]))) {
    throw new Error("NHS RTT annual data pages did not expose a sortable financial year");
  }
  return new URL(candidates[0].href, landingUrl).toString();
}

function discoverRttPressNoticeUrl(html, dataPageUrl) {
  const candidates = anchors(html).filter(
    (link) =>
      /RTT statistical press notice/i.test(link.text) &&
      /\.pdf(?:[?#].*)?$/i.test(link.href)
  );
  if (candidates.length === 0) {
    throw new Error("NHS RTT data page did not expose a latest statistical press notice PDF");
  }
  candidates.sort((left, right) => releaseRank(right) - releaseRank(left));
  if (!Number.isFinite(releaseRank(candidates[0]))) {
    throw new Error("NHS RTT press notices did not expose a sortable month and year");
  }
  return new URL(candidates[0].href, dataPageUrl).toString();
}

function discoverRttTimeseriesUrl(html, dataPageUrl) {
  const candidates = anchors(html).filter(
    (link) =>
      /RTT Overview Timeseries Including Estimates for Missing Trusts/i.test(link.text) &&
      /\.xlsx(?:[?#].*)?$/i.test(link.href)
  );
  if (candidates.length === 0) {
    throw new Error("NHS RTT data page did not expose the official overview time-series workbook");
  }
  candidates.sort((left, right) => releaseRank(right) - releaseRank(left));
  if (!Number.isFinite(releaseRank(candidates[0]))) {
    throw new Error("NHS RTT time-series workbooks did not expose a sortable month and year");
  }
  return new URL(candidates[0].href, dataPageUrl).toString();
}

function requiredMatch(text, expression, label) {
  const match = text.match(expression);
  if (!match) {
    throw new Error(`NHS RTT press notice did not expose ${label}`);
  }
  return match;
}

function strictInteger(value, label) {
  const parsed = Number.parseInt(String(value).replace(/,/g, ""), 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Unable to parse ${label}`);
  }
  return parsed;
}

function strictNumber(value, label) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse ${label}`);
  }
  return parsed;
}

function periodEnd(period) {
  const match = String(period).match(/^([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse NHS RTT period '${period}'`);
  }
  return Date.UTC(Number(match[2]), month + 1, 0);
}

function isoDate(value, label) {
  const match = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse ${label} '${value}'`);
  }
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  if (
    date.getUTCFullYear() !== Number(match[3]) ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== Number(match[1])
  ) {
    throw new Error(`Unable to parse ${label} '${value}'`);
  }
  return date.toISOString().slice(0, 10);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMissingTrusts(text) {
  const sectionMatch = text.match(
    /Missing data for\s+[A-Za-z]+\s+\d{4}\s+(.+?)(?:did not submit|did not provide)[^.]*\./i
  );
  if (!sectionMatch) return [];

  const trusts = [];
  const trustPattern = /([^(),;]+?)\s+\(([A-Z0-9]{3,5})\)/g;
  let match = trustPattern.exec(sectionMatch[1]);
  while (match !== null) {
    const name = match[1]
      .trim()
      .replace(/^(?:and|or)\s+/i, "")
      .replace(/^[,;]\s*/, "")
      .trim();
    if (name) trusts.push({ name, code: match[2] });
    match = trustPattern.exec(sectionMatch[1]);
  }

  if (trusts.length === 0) {
    throw new Error("NHS RTT missing-data section did not expose coded trusts");
  }
  return trusts;
}

function parseSpecialties(text) {
  const specialties = [];
  for (const name of TREATMENT_FUNCTIONS) {
    const match = text.match(
      new RegExp(`${escapeRegExp(name)}\\s+([\\d,]+)\\s+([\\d.]+)%`, "i")
    );
    if (!match) continue;
    specialties.push({
      name,
      incompletePathways: strictInteger(match[1], `${name} incomplete pathways`),
      within18WeeksPercent: strictNumber(
        match[2],
        `${name} within-18-weeks percentage`
      ),
    });
  }

  if (specialties.length < 8) {
    throw new Error(
      `NHS RTT press notice exposed only ${specialties.length} treatment-function rows`
    );
  }

  return specialties
    .sort((left, right) => right.incompletePathways - left.incompletePathways)
    .slice(0, 8);
}

function parseNhsRttPressNotice(text, source) {
  const normalized = String(text)
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const period = requiredMatch(
    normalized,
    /NHS referral to treatment \(RTT\) waiting times data\s+([A-Za-z]+\s+\d{4})/i,
    "publication period"
  )[1];
  const publicationDate = isoDate(
    requiredMatch(
      normalized.slice(0, 300),
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      "publication date"
    )[1],
    "publication date"
  );
  const waitingMillions = strictNumber(
    requiredMatch(
      normalized,
      /number of RTT pathways where a patient was waiting to start treatment at the end of\s+[A-Za-z]+\s+\d{4}\s+was\s+([\d.]+)\s+million/i,
      "waiting-pathway estimate"
    )[1],
    "waiting-pathway estimate"
  );
  const uniqueMillions = strictNumber(
    requiredMatch(
      normalized,
      /number of unique patients is estimated to be around\s+([\d.]+)\s+million/i,
      "unique-patient estimate"
    )[1],
    "unique-patient estimate"
  );
  const thresholdMatch = requiredMatch(
    normalized,
    /in\s+([\d,]+)\s+cases the patient was waiting more than 52 weeks,\s+in\s+([\d,]+)\s+cases they were waiting more than 65 weeks,\s+in\s+([\d,]+)\s+cases they were waiting more than 78 weeks,\s+and in\s+([\d,]+)\s+cases they were waiting more than 104 weeks/i,
    "long-wait thresholds"
  );
  const within18WeeksPercent = strictNumber(
    requiredMatch(
      normalized,
      /In\s+([\d.]+)%\s+of cases the patient had been waiting up to 18 weeks/i,
      "within-18-weeks percentage"
    )[1],
    "within-18-weeks percentage"
  );
  const medianMatch = requiredMatch(
    normalized,
    /median waiting time was\s+([\d.]+)\s+weeks\.\s+The 92nd percentile waiting time was\s+([\d.]+)\s+weeks/i,
    "median and 92nd-percentile waits"
  );
  const yearChangeMatch = requiredMatch(
    normalized,
    /incomplete pathways\) at the end of\s+[A-Za-z]+\s+\d{4}\s+(increased|decreased) by\s+([\d.]+)%\s+\(([\d,]+)\)\s+compared to the end of/i,
    "year-on-year waiting-list change"
  );
  const direction = yearChangeMatch[1].toLowerCase() === "decreased" ? -1 : 1;

  return {
    headline: {
      period,
      observedAt: periodEnd(period),
      publicationDate,
      waitingPathwaysEstimate: Math.round(waitingMillions * 1_000_000),
      waitingPathwaysDisplay: `${waitingMillions.toFixed(1)} million`,
      uniquePatientsEstimate: Math.round(uniqueMillions * 1_000_000),
      within18WeeksPercent,
      standardPercent: 92,
      medianWaitWeeks: strictNumber(medianMatch[1], "median wait"),
      percentile92WaitWeeks: strictNumber(
        medianMatch[2],
        "92nd-percentile wait"
      ),
      over52Weeks: strictInteger(thresholdMatch[1], "over-52-weeks count"),
      over65Weeks: strictInteger(thresholdMatch[2], "over-65-weeks count"),
      over78Weeks: strictInteger(thresholdMatch[3], "over-78-weeks count"),
      over104Weeks: strictInteger(thresholdMatch[4], "over-104-weeks count"),
      yearChangePercent:
        direction * strictNumber(yearChangeMatch[2], "year change percentage"),
      yearChangePathways:
        direction * strictInteger(yearChangeMatch[3], "year change pathways"),
      newPathways: strictInteger(
        requiredMatch(
          normalized,
          /During\s+[A-Za-z]+\s+\d{4},\s+([\d,]+)\s+new RTT pathways were started/i,
          "new RTT pathways"
        )[1],
        "new RTT pathways"
      ),
      admittedCompleted: strictInteger(
        requiredMatch(
          normalized,
          /([\d,]+)\s+pathways were completed as a result of admitted treatment/i,
          "admitted completions"
        )[1],
        "admitted completions"
      ),
      nonAdmittedCompleted: strictInteger(
        requiredMatch(
          normalized,
          /and\s+([\d,]+)\s+were completed in other ways \(non-admitted\)/i,
          "non-admitted completions"
        )[1],
        "non-admitted completions"
      ),
    },
    specialties: parseSpecialties(normalized),
    missingTrusts: parseMissingTrusts(normalized),
    methodology: {
      geography: "England",
      measure: "Incomplete consultant-led referral-to-treatment pathways",
      waitingListUnit: "pathways",
      peopleCaveat:
        "Some patients are on more than one pathway, so the pathway total is not a count of unique people.",
      estimatesCaveat:
        "National headline figures include NHS England estimates for acute trusts that did not submit data. Treatment-function rows do not include those estimates.",
      revisionNote:
        "NHS England publishes periodic revisions, usually every six months, when providers submit corrections.",
    },
    source: {
      publisher: "NHS England",
      landingUrl: source.landingUrl,
      dataPageUrl: source.dataPageUrl,
      pressNoticeUrl: source.pressNoticeUrl,
    },
  };
}

export {
  TREATMENT_FUNCTIONS,
  discoverRttDataPageUrl,
  discoverRttPressNoticeUrl,
  discoverRttTimeseriesUrl,
  parseNhsRttPressNotice,
};
