// @vitest-environment node

import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sharedStrings, workbookSheetCells, worksheetCells, zipEntries } from "../../worker/xlsx-workbook.js";

function zipFixture(entries: Array<{
  name: string;
  data: Buffer;
  method?: 0 | 8;
  declaredSize?: number;
}>): ArrayBuffer {
  const localFiles: Buffer[] = [];
  const directoryEntries: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const method = entry.method ?? 8;
    const compressed = method === 0 ? entry.data : deflateRawSync(entry.data);
    const declaredSize = entry.declaredSize ?? entry.data.length;
    const local = Buffer.alloc(30 + name.length + compressed.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(declaredSize, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    compressed.copy(local, 30 + name.length);
    localFiles.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(declaredSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    directoryEntries.push(central);
    localOffset += local.length;
  }

  const directory = Buffer.concat(directoryEntries);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  const archive = Buffer.concat([...localFiles, directory, end]);
  return archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength);
}

function workbookEntries(sheets: string[]) {
  return [
    { name: "xl/workbook.xml", data: Buffer.from(`<workbook><sheets>${sheets.map((_, i) => `<sheet name="Sheet${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`<Relationships>${sheets.map((_, i) => `<Relationship id="rId${i + 1}" target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`) },
    ...sheets.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(xml) })),
  ];
}

describe("bounded spreadsheet decompression", () => {
  it("stops a deflate entry as soon as expanded bytes cross its configured limit", async () => {
    const bomb = Buffer.alloc(8 * 1024 * 1024 + 1, 0x61);
    const archive = zipFixture([{ name: "xl/sharedStrings.xml", data: bomb }]);

    await expect(
      zipEntries(archive, {
        maxEntryBytes: 8 * 1024 * 1024,
        maxTotalBytes: 24 * 1024 * 1024,
      }),
    ).rejects.toThrow(/entry.*limit|expanded.*limit/i);
  });

  it("rejects aggregate expansion across individually valid entries", async () => {
    const piece = Buffer.alloc(6 * 1024 * 1024, 0x61);
    const archive = zipFixture([
      { name: "xl/sharedStrings.xml", data: piece },
      { name: "xl/worksheets/sheet1.xml", data: piece },
    ]);

    await expect(
      zipEntries(archive, { maxEntryBytes: 8 * 1024 * 1024, maxTotalBytes: 10 * 1024 * 1024 }),
    ).rejects.toThrow(/expanded contents.*limit/i);
  });

  it("bounds worksheet rows and workbook cells before constructing the cells map", () => {
    const xml = "<worksheet><row><c r='A1'><v>1</v></c></row><row><c r='A2'><v>2</v></c></row></worksheet>";
    expect(() => worksheetCells(xml, [], { maxWorksheetRows: 1 })).toThrow(/row.*limit/i);
    expect(() => worksheetCells(xml, [], { maxWorkbookCells: 1 })).toThrow(/cell.*limit/i);
  });

  it("caps optional limits at the reviewed worker defaults", async () => {
    await expect(
      zipEntries(new ArrayBuffer(0), { maxTotalBytes: 25 * 1024 * 1024 }),
    ).rejects.toThrow(/no greater than 25165824/);
  });

  it("caps shared-string expansion into a JavaScript array", () => {
    expect(() => sharedStrings("<sst><si><t>a</t></si><si><t>b</t></si></sst>", {
      maxWorkbookCells: 1,
    })).toThrow(/shared strings.*limit/i);
  });

  it("counts cells and rows across every worksheet, not only the selected one", async () => {
    const archive = zipFixture(workbookEntries([
      "<worksheet><row><c r='A1'><v>1</v></c></row></worksheet>",
      "<worksheet><row><c r='A1'><v>2</v></c></row></worksheet>",
    ]));
    await expect(workbookSheetCells(archive, "Sheet1", { maxWorkbookCells: 1 }))
      .rejects.toThrow(/cell.*limit/i);
  });

  it("applies the expanded-entry cap to stored ZIP entries", async () => {
    const data = Buffer.alloc(8 * 1024 * 1024 + 1, 0x61);
    const archive = zipFixture([{ name: "xl/sharedStrings.xml", data, method: 0 }]);
    await expect(zipEntries(archive)).rejects.toThrow(/entry.*limit/i);
  });

  it("ignores forged uncompressed size fields and counts actual deflate output", async () => {
    const data = Buffer.alloc(2 * 1024 * 1024, 0x61);
    const archive = zipFixture([{ name: "xl/sharedStrings.xml", data, declaredSize: 1 }]);
    await expect(zipEntries(archive, { maxEntryBytes: 1024, maxTotalBytes: 2048 }))
      .rejects.toThrow(/entry.*limit/i);
  });
});
