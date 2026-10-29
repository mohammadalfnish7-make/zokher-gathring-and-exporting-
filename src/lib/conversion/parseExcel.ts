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

export function parseExcelBuffer(
  buffer: Buffer,
  filename: string,
): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  // Filename is authoritative when it encodes a DR id (sample DR-1249.xlsx
  // still has a stale DR1245 in cell A2 while the PDF is DR1249).
  const fromFilename = drCodeFromFilename(filename);
  let drCode = fromFilename;
  let sawFilenameDr = /^DR\d+/i.test(fromFilename);
  let palletNote = "";
  const extractedComments: string[] = [];
  const lines: LineItem[] = [];
  let headerIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const a = cellString(row[0]);
    const h = cellString(row[7]);

    if (!sawFilenameDr && i < 5 && /^DR/i.test(a)) {
      drCode = normalizeDrCode(a);
    }
    if (h && /поддон|контейн/i.test(h)) {
      palletNote = h;
    } else if (h && !/^примечание$/i.test(h)) {
      extractedComments.push(h);
    }
    if (
      a.toLowerCase() === "no" &&
      cellString(row[1]).toLowerCase() === "mark"
    ) {
      headerIndex = i;
      if (h && !/^примечание$/i.test(h)) {
        if (/поддон|контейн/i.test(h)) palletNote = h;
        else extractedComments.push(h);
      }
      continue;
    }
    if (headerIndex < 0) continue;
    if (!a || a.toUpperCase() === "TOTAL") break;
    if (!/^\d+$/.test(a)) continue;

    lines.push({
      no: Number(a),
      mark: cellString(row[1]),
      shop: cellString(row[2]),
      systemCode: cellString(row[3]),
      cartons: parseNumber(row[4]),
      weight: parseNumber(row[5]),
    });
  }

  // Fallback pallet note from column H anywhere
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
    drCode,
    lines,
    palletNote,
    extractedComments: [...new Set(extractedComments)],
    sheetName,
  };
}
