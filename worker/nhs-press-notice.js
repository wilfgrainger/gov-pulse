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

function requiredMatch(text, expression, label) {
  const match = text.match(expression);
  if (!match) throw new Error(`NHS RTT press notice did not expose ${label}`);
  return match;
}

function strictInteger(value, label) {
  const parsed = Number.parseInt(String(value).replace(/,/g, ""), 10);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Unable to parse ${label}`);
  return parsed;
}

function strictNumber(value, label) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) throw new Error(`Unable to parse ${label}`);
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
  const section = text.match(
    /Missing data for\s+[A-Za-z]+\s+\d{4}\s+(.+?)(?:did not submit|did not provide)[^.]*\./i
  );
  if (!section) return [];
  const trusts = [];
  for (const match of section[1].matchAll(/([^(),;]+?)\s+\(([A-Z0-9]{3,5})\)/g)) {
    const name = match[1]
      .trim()
      .replace(/^(?:and|or)\s+/i, "")
      .replace(/^[,;]\s*/, "")
      .trim();
    if (name) trusts.push({ name, code: match[2] });
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

function parseNhsRttPressNotice(text) {
  const normalized = String(text)
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    // PDF text extraction can split glyphs inside numbers and a handful of
    // repeated labels; repair only those unambiguous boundaries.
    .replace(/(\d)\s+\.\s+(\d)/g, "$1.$2")
    .replace(/(\d+)\.\s+(\d)/g, "$1.$2")
    .replace(/(\d)\s+(\d)(?=\.\d)/g, "$1$2")
    .replace(/(\d)\s+%/g, "$1%")
    .replace(/\(\s+([\d,]+)\s+\)/g, "($1)")
    .replace(/(\d+)\s+nd\b/gi, "$1nd")
    .replace(/\bm\s+illion\b/gi, "million")
    .replace(/\bR\s+TT\b/g, "RTT")
    .replace(/\binco\s+m\s+plete\b/gi, "incomplete")
    .replace(/\bMissing\s+d\s+ata\b/gi, "Missing data")
    .replace(/\bpathway\s+s\b/gi, "pathways")
    .replace(/\bp\s+atients?\b/gi, (value) =>
      value.toLowerCase().endsWith("s") ? "patients" : "patient"
    )
    .replace(/\bchart\s+s\b/gi, "charts")
    .replace(/\bp\s+atient\b/gi, "patient")
    .replace(/\bb\s+y\b/gi, "by")
    .replace(/\s+,/g, ",")
    .replace(/\s*-\s*/g, "-")
    .trim();
  const period = requiredMatch(
    normalized,
    /NHS referral to treatment \(RTT\) waiting times data\s+([A-Za-z]+\s+\d{4})/i,
    "publication period"
  )[1];
  const publicationDateMatch =
    normalized.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s+Statistical Press Notice/i
    ) ??
    normalized
      .slice(0, 500)
      .match(
        /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
      );
  if (!publicationDateMatch) {
    throw new Error("NHS RTT press notice did not expose publication date");
  }
  const publicationDate = isoDate(publicationDateMatch[1], "publication date");
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
  const thresholds = requiredMatch(
    normalized,
    /in\s+([\d,]+)\s+cases the patient was waiting more than 52 weeks,\s+in\s+([\d,]+)\s+cases they were waiting more than 65 weeks,\s+in\s+([\d,]+)\s+cases they were waiting more than 78 weeks,\s+and in\s+([\d,]+)\s+cases they were waiting more than 104 weeks/i,
    "long-wait thresholds"
  );
  const median = requiredMatch(
    normalized,
    /median waiting time was\s+([\d.]+)\s+weeks\.\s+The 92nd percentile waiting time was\s+([\d.]+)\s+weeks/i,
    "median and 92nd-percentile waits"
  );
  const yearChange = requiredMatch(
    normalized,
    /incomplete pathways\) at the end of\s+[A-Za-z]+\s+\d{4}\s+(increased|decreased) by\s+([\d.]+)%\s+\(([\d,]+)\)\s+compared to the end of/i,
    "year-on-year waiting-list change"
  );
  const direction = yearChange[1].toLowerCase() === "decreased" ? -1 : 1;

  return {
    headline: {
      period,
      observedAt: periodEnd(period),
      publicationDate,
      waitingPathwaysEstimate: Math.round(waitingMillions * 1_000_000),
      uniquePatientsEstimate: Math.round(uniqueMillions * 1_000_000),
      within18WeeksPercent: strictNumber(
        requiredMatch(
          normalized,
          /In\s+([\d.]+)%\s+of cases the patient had been waiting up to 18 weeks/i,
          "within-18-weeks percentage"
        )[1],
        "within-18-weeks percentage"
      ),
      standardPercent: 92,
      medianWaitWeeks: strictNumber(median[1], "median wait"),
      percentile92WaitWeeks: strictNumber(median[2], "92nd-percentile wait"),
      over52Weeks: strictInteger(thresholds[1], "over-52-weeks count"),
      over65Weeks: strictInteger(thresholds[2], "over-65-weeks count"),
      over78Weeks: strictInteger(thresholds[3], "over-78-weeks count"),
      over104Weeks: strictInteger(thresholds[4], "over-104-weeks count"),
      yearChangePercent:
        direction * strictNumber(yearChange[2], "year change percentage"),
      yearChangePathways:
        direction * strictInteger(yearChange[3], "year change pathways"),
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
  };
}

export { TREATMENT_FUNCTIONS, parseNhsRttPressNotice };
