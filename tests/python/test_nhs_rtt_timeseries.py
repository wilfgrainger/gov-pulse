import html
import importlib.util
import tempfile
import unittest
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PARSER_PATH = ROOT / "scripts" / "nhs-rtt-timeseries.py"
SPEC = importlib.util.spec_from_file_location("nhs_rtt_timeseries", PARSER_PATH)
PARSER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARSER)

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

METADATA = {
    "B2": "Title: Referral to Treatment (RTT) Waiting Times, England",
    "B4": "Period: January 2025 to January 2026",
    "B5": "Main Source: NHS England, monthly RTT data collection",
    "B7": "Basis: Commissioner",
    "B9": "Revised: ",
    "C9": "-",
}
HEADERS = {
    "B11": "Year",
    "C11": "Month",
    "D11": "Incomplete RTT pathways",
    "X11": "Unique Patients\n",
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


def excel_serial(year, month):
    value = datetime(year, month, 1, tzinfo=timezone.utc)
    origin = datetime(1899, 12, 30, tzinfo=timezone.utc)
    return (value - origin).days


def cell_column(reference):
    return "".join(character for character in reference if character.isalpha())


def cell_row(reference):
    return int("".join(character for character in reference if character.isdigit()))


class WorkbookFixture:
    def __init__(self, inline_strings=False):
        self.inline_strings = inline_strings
        self.shared = []
        self.shared_index = {}

    def string_cell(self, reference, value):
        escaped = html.escape(value)
        if self.inline_strings:
            return f'<c r="{reference}" t="inlineStr"><is><t>{escaped}</t></is></c>'
        index = self.shared_index.get(value)
        if index is None:
            index = len(self.shared)
            self.shared_index[value] = index
            self.shared.append(value)
        return f'<c r="{reference}" t="s"><v>{index}</v></c>'

    @staticmethod
    def number_cell(reference, value):
        return f'<c r="{reference}"><v>{value}</v></c>'

    def build(
        self,
        path,
        *,
        sheet_name="Full Time Series",
        metadata_overrides=None,
        header_overrides=None,
        omitted_cells=None,
        decoy_cells=None,
        latest_month=(2026, 1),
    ):
        values = dict(METADATA)
        values.update(HEADERS)
        values.update(metadata_overrides or {})
        values.update(header_overrides or {})
        values.update(decoy_cells or {})
        for reference in omitted_cells or set():
            values.pop(reference, None)

        rows = {}
        for reference, value in values.items():
            rows.setdefault(cell_row(reference), []).append(
                self.string_cell(reference, value)
            )

        months = []
        year, month = 2025, 1
        while (year, month) <= latest_month:
            months.append((year, month))
            month += 1
            if month == 13:
                year += 1
                month = 1
        if len(months) < 13:
            raise ValueError("Fixture must contain at least 13 months")

        numeric_columns = {
            "D": lambda index: 10 + index,
            "E": lambda index: 20 + index,
            "I": lambda index: 0.50 + index / 100,
            "M": lambda index: 100 + index,
            "Q": lambda index: 50 + index,
            "S": lambda index: 20 + index,
            "U": lambda index: 10 + index,
            "W": lambda index: 1000 + index,
            "Y": lambda index: 900 + index,
            "AE": lambda index: 200 + index,
            "AK": lambda index: 300 + index,
            "AM": lambda index: 400 + index,
        }
        for index, (year, month) in enumerate(months):
            row_number = 13 + index
            rows.setdefault(row_number, []).append(
                self.number_cell(f"C{row_number}", excel_serial(year, month))
            )
            for column, value in numeric_columns.items():
                rows[row_number].append(
                    self.number_cell(f"{column}{row_number}", value(index))
                )

        row_xml = "".join(
            f'<row r="{row_number}">{"".join(cells)}</row>'
            for row_number, cells in sorted(rows.items())
        )
        worksheet = (
            f'<worksheet xmlns="{MAIN_NS}"><sheetData>{row_xml}</sheetData></worksheet>'
        )
        workbook = (
            f'<workbook xmlns="{MAIN_NS}" xmlns:r="{REL_NS}"><sheets>'
            f'<sheet name="{html.escape(sheet_name)}" sheetId="1" r:id="rId1"/>'
            "</sheets></workbook>"
        )
        relationships = (
            f'<Relationships xmlns="{PACKAGE_REL_NS}">'
            f'<Relationship Id="rId1" Type="{REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>'
            "</Relationships>"
        )

        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("xl/workbook.xml", workbook)
            archive.writestr("xl/_rels/workbook.xml.rels", relationships)
            archive.writestr("xl/worksheets/sheet1.xml", worksheet)
            if not self.inline_strings:
                items = "".join(
                    f"<si><t>{html.escape(value)}</t></si>" for value in self.shared
                )
                archive.writestr(
                    "xl/sharedStrings.xml",
                    f'<sst xmlns="{MAIN_NS}" count="{len(self.shared)}" uniqueCount="{len(self.shared)}">{items}</sst>',
                )


class NhsRttWorkbookTests(unittest.TestCase):
    def parse_fixture(self, **options):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.xlsx"
            WorkbookFixture(options.pop("inline_strings", False)).build(path, **options)
            return PARSER.parse(path)

    def assert_invalid(self, expected, **options):
        with self.assertRaisesRegex(ValueError, expected):
            self.parse_fixture(**options)

    def test_valid_shared_string_workbook_preserves_history_values(self):
        result = self.parse_fixture()
        self.assertEqual(result["history"][-1]["period"], "January 2026")
        self.assertEqual(result["history"][-1]["medianWaitWeeks"], 22.0)
        self.assertEqual(result["history"][-1]["within18WeeksPercent"], 62.0)
        self.assertEqual(result["annualDelta"]["medianWaitWeeks"], 12.0)
        self.assertEqual(result["annualDelta"]["waitingPathwaysEstimate"], 12)

    def test_valid_inline_string_workbook_is_supported(self):
        result = self.parse_fixture(inline_strings=True)
        self.assertEqual(result["history"][-1]["period"], "January 2026")

    def test_wrong_publisher_is_rejected_at_the_source_cell(self):
        self.assert_invalid(
            "B5 must equal",
            metadata_overrides={"B5": "Main Source: Example publisher"},
        )

    def test_wrong_geography_is_rejected_at_the_title_cell(self):
        self.assert_invalid(
            "B2 must equal",
            metadata_overrides={
                "B2": "Title: Referral to Treatment (RTT) Waiting Times, Wales"
            },
        )

    def test_wrong_measure_header_is_rejected(self):
        self.assert_invalid(
            "header D12 must equal",
            header_overrides={"D12": "Mean wait (weeks)"},
        )

    def test_missing_revision_status_is_rejected(self):
        self.assert_invalid("C9 did not expose revision", omitted_cells={"C9"})

    def test_renamed_sheet_is_rejected(self):
        self.assert_invalid("Full Time Series", sheet_name="RTT data")

    def test_decoy_keywords_elsewhere_do_not_validate_wrong_metadata(self):
        self.assert_invalid(
            "B2 must equal",
            metadata_overrides={"B2": "Unrelated workbook"},
            decoy_cells={
                "D1": "Referral to Treatment (RTT) Waiting Times, England",
                "E1": "NHS England",
                "F1": "Commissioner",
            },
        )

    def test_declared_period_must_match_latest_observation(self):
        self.assert_invalid(
            "latest observation did not match",
            metadata_overrides={"B4": "Period: January 2025 to February 2026"},
        )


if __name__ == "__main__":
    unittest.main()
