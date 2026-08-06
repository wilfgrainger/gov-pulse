import json
import posixpath
import re
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS, "pr": PACKAGE_REL_NS}
SHEET_NAME = "Full Time Series"
MONTHS = {
    month: index
    for index, month in enumerate(
        (
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ),
        start=1,
    )
}
METADATA_CELLS = {
    "B2": "Title: Referral to Treatment (RTT) Waiting Times, England",
    "B5": "Main Source: NHS England, monthly RTT data collection",
    "B7": "Basis: Commissioner",
    "B9": "Revised:",
}
HEADER_CELLS = {
    "B11": "Year",
    "C11": "Month",
    "D11": "Incomplete RTT pathways",
    "X11": "Unique Patients",
    "Z11": "Completed admitted (unadjusted) RTT pathways",
    "AF11": "Completed non-admitted RTT pathways",
    "AL11": "New RTT periods",
    "D12": "Median wait (weeks)",
    "E12": "92nd percentile (weeks)",
    "I12": "% within 18 weeks with estimates for missing data",
    "M12": "No. > 52 weeks with estimates for missing data",
    "Q12": "No. > 65 weeks with estimates for missing data",
    "S12": "No. > 78 weeks with estimates for missing data",
    "U12": "No. > 104 weeks with estimates for missing data",
    "W12": "Total waiting (mil) with estimates for missing data",
    "Y12": "Estimated number of unique patients (mil)",
    "AE12": "No. of pathways (all) with estimates for missing data",
    "AK12": "No. of pathways (all) with estimates for missing data",
    "AM12": "No. of new RTT periods with estimates for missing data",
}
PERIOD_PATTERN = re.compile(
    r"^Period:\s+(?P<start_month>[A-Za-z]+)\s+(?P<start_year>\d{4})"
    r"\s+to\s+(?P<end_month>[A-Za-z]+)\s+(?P<end_year>\d{4})$"
)
FIELDS = {
    "medianWaitWeeks": "D",
    "percentile92WaitWeeks": "E",
    "within18WeeksPercent": "I",
    "over52Weeks": "M",
    "over65Weeks": "Q",
    "over78Weeks": "S",
    "over104Weeks": "U",
    "waitingPathwaysEstimate": "W",
    "uniquePatientsEstimate": "Y",
    "admittedCompleted": "AE",
    "nonAdmittedCompleted": "AK",
    "newPathways": "AM",
}
INTEGER_FIELDS = {
    "over52Weeks",
    "over65Weeks",
    "over78Weeks",
    "over104Weeks",
    "waitingPathwaysEstimate",
    "uniquePatientsEstimate",
    "admittedCompleted",
    "nonAdmittedCompleted",
    "newPathways",
}
REQUIRED_NUMERIC_COLUMNS = ("C", "D", "E", "I", "M", "W", "AE", "AK", "AM")


def normalize_text(value):
    return " ".join(str(value or "").split())


def cell_column(reference):
    return "".join(character for character in reference if character.isalpha())


def text_content(node):
    return "".join(part.text or "" for part in node.findall(".//m:t", NS))


def shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    return [text_content(item) for item in root.findall("m:si", NS)]


def cell_text(cell, strings):
    kind = cell.attrib.get("t")
    value = cell.find("m:v", NS)
    if kind == "s":
        if value is None or value.text is None:
            return ""
        try:
            return strings[int(value.text)]
        except (ValueError, IndexError) as error:
            raise ValueError("NHS RTT workbook contained an invalid shared-string reference") from error
    if kind == "inlineStr":
        return text_content(cell)
    if value is not None and value.text is not None:
        return value.text
    return text_content(cell)


def worksheet_cells(sheet, strings):
    values = {}
    for cell in sheet.findall(".//m:sheetData/m:row/m:c", NS):
        reference = cell.attrib.get("r")
        if reference:
            values[reference] = cell_text(cell, strings)
    return values


def workbook_sheet_path(archive):
    workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
    relationships = ElementTree.fromstring(
        archive.read("xl/_rels/workbook.xml.rels")
    )
    targets = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in relationships
    }
    sheets = workbook.find("m:sheets", NS)
    if sheets is None:
        raise ValueError("NHS RTT workbook did not expose any worksheets")

    matches = [sheet for sheet in sheets if sheet.attrib.get("name") == SHEET_NAME]
    if len(matches) != 1:
        raise ValueError(
            f"NHS RTT workbook must expose exactly one '{SHEET_NAME}' worksheet"
        )

    relationship_id = matches[0].attrib.get(f"{{{REL_NS}}}id")
    if not relationship_id or relationship_id not in targets:
        raise ValueError("NHS RTT workbook sheet relationship was missing")
    target = targets[relationship_id].replace("\\", "/").lstrip("/")
    target = target if target.startswith("xl/") else f"xl/{target}"
    normalized = posixpath.normpath(target)
    if not normalized.startswith("xl/worksheets/") or normalized not in archive.namelist():
        raise ValueError("NHS RTT workbook sheet relationship was not a valid worksheet")
    return normalized


def parse_period(value):
    match = PERIOD_PATTERN.fullmatch(normalize_text(value))
    if not match:
        raise ValueError("NHS RTT workbook B4 did not expose the expected reporting period")
    try:
        start_month = MONTHS[match.group("start_month")]
        end_month = MONTHS[match.group("end_month")]
    except KeyError as error:
        raise ValueError("NHS RTT workbook reporting period used an unknown month") from error
    start = (int(match.group("start_year")), start_month)
    end = (int(match.group("end_year")), end_month)
    if start > end:
        raise ValueError("NHS RTT workbook reporting period ended before it started")
    return {"start": start, "end": end, "text": normalize_text(value)}


def validate_workbook_identity(archive):
    strings = shared_strings(archive)
    sheet = ElementTree.fromstring(archive.read(workbook_sheet_path(archive)))
    cells = worksheet_cells(sheet, strings)

    for reference, expected in METADATA_CELLS.items():
        actual = normalize_text(cells.get(reference))
        if actual != expected:
            raise ValueError(
                f"NHS RTT workbook {reference} must equal '{expected}', found '{actual or '<missing>'}'"
            )

    period = parse_period(cells.get("B4"))
    revision = normalize_text(cells.get("C9"))
    if not revision:
        raise ValueError("NHS RTT workbook C9 did not expose revision status")

    for reference, expected in HEADER_CELLS.items():
        actual = normalize_text(cells.get(reference))
        if actual != expected:
            raise ValueError(
                f"NHS RTT workbook header {reference} must equal '{expected}', found '{actual or '<missing>'}'"
            )

    return {
        "sheet": sheet,
        "period": period,
        "revision": revision,
    }


def numeric_cells(row):
    values = {}
    for cell in row.findall("m:c", NS):
        if cell.attrib.get("t") not in (None, "n"):
            continue
        value = cell.find("m:v", NS)
        if value is None or value.text is None:
            continue
        try:
            values[cell_column(cell.attrib["r"])] = float(value.text)
        except ValueError:
            continue
    return values


def excel_date(serial):
    return datetime(1899, 12, 30, tzinfo=timezone.utc) + timedelta(days=serial)


def normalize_value(field, value):
    if field == "within18WeeksPercent":
        return round(value * 100, 1)
    if field in INTEGER_FIELDS:
        return round(value)
    return round(value, 1)


def extract_history(sheet):
    history = []
    previous_observed = None
    for row in sheet.findall(".//m:sheetData/m:row", NS):
        cells = numeric_cells(row)
        if not all(column in cells for column in REQUIRED_NUMERIC_COLUMNS):
            continue
        observed = excel_date(cells["C"])
        if observed.year < 2016:
            continue
        if previous_observed is not None and observed <= previous_observed:
            raise ValueError("NHS RTT workbook observation months were not strictly increasing")
        previous_observed = observed
        point = {
            "period": observed.strftime("%B %Y"),
            "observedAt": int(
                (
                    datetime(
                        observed.year + (1 if observed.month == 12 else 0),
                        1 if observed.month == 12 else observed.month + 1,
                        1,
                        tzinfo=timezone.utc,
                    )
                    - timedelta(days=1)
                ).timestamp()
                * 1000
            ),
        }
        for field, column in FIELDS.items():
            point[field] = (
                normalize_value(field, cells[column]) if column in cells else None
            )
        history.append(point)
    return history[-120:]


def annual_delta(history):
    if len(history) < 13:
        raise ValueError("NHS RTT workbook did not expose a ten-year comparable history")
    latest = history[-1]
    prior_year = history[-13]
    result = {}
    for field in FIELDS:
        if latest[field] is None or prior_year[field] is None:
            result[field] = None
        elif field in INTEGER_FIELDS:
            result[field] = round(latest[field] - prior_year[field])
        else:
            result[field] = round(latest[field] - prior_year[field], 1)
    return result


def parse(path):
    with zipfile.ZipFile(path) as archive:
        identity = validate_workbook_identity(archive)
        history = extract_history(identity["sheet"])

    if len(history) < 13:
        raise ValueError("NHS RTT workbook did not expose a ten-year comparable history")
    latest = datetime.fromtimestamp(history[-1]["observedAt"] / 1000, timezone.utc)
    declared_end = identity["period"]["end"]
    if (latest.year, latest.month) != declared_end:
        raise ValueError(
            "NHS RTT workbook latest observation did not match the period declared in B4"
        )
    return {"history": history, "annualDelta": annual_delta(history)}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: nhs-rtt-timeseries.py <workbook.xlsx>")
    print(json.dumps(parse(sys.argv[1]), separators=(",", ":")))
