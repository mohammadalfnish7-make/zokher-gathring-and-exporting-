import * as XLSX from "xlsx";
import { drCodeFromFilename, normalizeDrCode, parseNumber } from "./normalize";
import type { LineItem } from "../types";

export type ParsedExcel = {
  drCode: string;
  lines: LineItem[];
  palletNote: string;
  extractedComments: string[];
  sheetName: string;
};

function cellString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/** Sample workbooks have one stray cell near row 1,047,947. Walking that gap takes seconds. */
function denseRange(sheet: XLSX.WorkSheet): XLSX.Range | undefined {
  const rowSet = new Set<number>();
  let maxC = 0;
  for (const key of Object.keys(sheet)) {
    if (key.startsWith("!")) continue;
    const cell = XLSX.utils.decode_cell(key);
    rowSet.add(cell.r);
    if (cell.c > maxC) maxC = cell.c;
  }
  const rows = [...rowSet].sort((a, b) => a - b);
  if (rows.length === 0) return undefined;
  let end = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] - rows[i - 1] > 50) break;
    end = rows[i];
  }
  return { s: { r: rows[0], c: 0 }, e: { r: end, c: Math.max(maxC, 7) } };
}

type HeaderCols = {
  kind: "sea" | "air";
  no: number;
  mark: number;
  shop: number;
  system: number;
  cartons: number;
  weight: number;
};

function headerCols(row: (string | number | null)[]): HeaderCols | null {
  const labels = row.map((cell) => cellString(cell).toLowerCase());
  if (labels[0] === "no" && labels[1] === "mark") {
    return {
      kind: "sea",
      no: 0,
      mark: 1,
      shop: 2,
      system: 3,
      cartons: 4,
      weight: 5,
    };
  }
  const mark = labels.findIndex((label) => label === "mark");
  const cartons = labels.findIndex((label) => label === "ctn" || label === "cartons");
  const weight = labels.findIndex((label) => label === "weight");
  const shop = labels.findIndex((label) => label.includes("shop"));
  if (mark < 0 || cartons < 0 || weight < 0 || shop < 0) return null;
  const no = labels.findIndex((label) => label === "no" || label === "sl no");
  return {
    kind: "air",
    no: no >= 0 ? no : 0,
    mark,
    shop,
    system: -1,
    cartons,
    weight,
  };
}

function sheetRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    range: denseRange(sheet),
  });
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  filenameCode: string,
): ParsedExcel {
  const rows = sheetRows(sheet);
  // Sea files can carry a stale DR code in the sheet. The filename wins.
  const filenameIsDr = /^DR\d+$/i.test(filenameCode);
  let drCode = filenameIsDr ? filenameCode : "";
  let palletNote = "";
  const extractedComments: string[] = [];
  const lines: LineItem[] = [];
  let cols: HeaderCols | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const a = cellString(row[0]);
    const h = cellString(row[7]);

    if (!cols && i < 5 && /^(DR|AR)/i.test(a) && !filenameIsDr) {
      drCode = normalizeDrCode(a);
    }

    if (!cols) {
      const found = headerCols(row);
      if (found?.kind !== "air") {
        if (h && /поддон|контейн/i.test(h)) palletNote = h;
        else if (h && !/^примечание$/i.test(h)) extractedComments.push(h);
      }
      cols = found;
      continue;
    }

    if (cols.kind === "sea") {
      if (h && /поддон|контейн/i.test(h)) palletNote = h;
      else if (h && !/^примечание$/i.test(h)) extractedComments.push(h);
    }

    const no = cellString(row[cols.no]);
    const mark = cellString(row[cols.mark]);
    if (!mark || no.toUpperCase() === "TOTAL" || mark.toUpperCase() === "TOTAL") {
      break;
    }
    if (cols.kind === "sea" && !/^\d+$/.test(no)) continue;
    if (cols.kind === "air" && no && !/^\d+$/.test(no)) continue;

    lines.push({
      no: /^\d+$/.test(no) ? Number(no) : lines.length + 1,
      mark,
      shop: cellString(row[cols.shop]),
      systemCode: cols.system >= 0 ? cellString(row[cols.system]) : "",
      cartons: parseNumber(row[cols.cartons]),
      weight: parseNumber(row[cols.weight]),
    });
  }

  if (!palletNote) {
    for (const row of rows) {
      const h = cellString(row?.[7]);
      if (h && /поддон|контейн/i.test(h)) {
        palletNote = h;
        break;
      }
    }
  }

  return {
    drCode: drCode || filenameCode,
    lines,
    palletNote,
    extractedComments: [...new Set(extractedComments)],
    sheetName,
  };
}

export function parseExcelBuffer(
  buffer: Buffer,
  filename: string,
): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const filenameCode = drCodeFromFilename(filename);
  const parsed = workbook.SheetNames.map((sheetName) =>
    parseSheet(workbook.Sheets[sheetName], sheetName, filenameCode),
  );
  const named = parsed.find(
    (sheet) =>
      sheet.lines.length > 0 &&
      sheet.drCode.toUpperCase() === filenameCode.toUpperCase(),
  );
  if (named) return named;
  return (
    parsed.sort((a, b) => b.lines.length - a.lines.length)[0] ?? {
      drCode: filenameCode,
      lines: [],
      palletNote: "",
      extractedComments: [],
      sheetName: workbook.SheetNames[0] ?? "",
    }
  );
}
