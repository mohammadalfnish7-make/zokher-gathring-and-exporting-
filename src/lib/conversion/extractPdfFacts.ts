import { PDFParse } from "pdf-parse";
import { parseNumber } from "./normalize";

export type PdfShopLine = {
  shop: string;
  cartons: number;
  weight: number;
};

export type PdfMarkGroup = {
  mark: string;
  cartons: number;
  weight: number;
  shops: PdfShopLine[];
};

export type PdfFacts = {
  text: string;
  drCode: string | null;
  totalCartons: number | null;
  totalWeight: number | null;
  marks: PdfMarkGroup[];
  markLines: { label: string; cartons: number; weight: number }[];
  hasRussianHeaders: boolean;
  hasGrandTotalLabel: boolean;
};

function isLikelyMark(label: string, knownMarks: Set<string>): boolean {
  if (knownMarks.has(label.toUpperCase())) return true;
  // Marks in samples are mostly numeric codes, optionally with EM prefix
  return /^(EM)?\d+$/i.test(label) || /^[A-Z]{0,3}\d{3,}$/i.test(label);
}

export async function extractPdfFacts(
  pdfBytes: Uint8Array,
  knownMarks: string[] = [],
): Promise<PdfFacts> {
  const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
  const result = await parser.getText();
  const text = result.text || "";
  const known = new Set(
    knownMarks.map((m) => m.toUpperCase()).concat(
      knownMarks.map((m) => `EM${m}`.toUpperCase()),
    ),
  );

  const drMatch = text.match(/\b(?:DR|AR)-?\d+\b/i);
  const totalMatch = text.match(
    /Общий итог\s+([\d\s.,]+)\s+([\d\s.,]+)/i,
  );

  const markLines: PdfFacts["markLines"] = [];
  for (const line of text.split(/\n+/)) {
    const m = line
      .trim()
      .match(/^([A-Za-z0-9][A-Za-z0-9 _./-]*?)\s+([\d.,]+)\s+([\d.,]+)\s*$/);
    if (!m) continue;
    const label = m[1].trim();
    if (/названия|сумма|общий/i.test(label)) continue;
    markLines.push({
      label,
      cartons: parseNumber(m[2]),
      weight: parseNumber(m[3]),
    });
  }

  const marks: PdfMarkGroup[] = [];
  let current: PdfMarkGroup | null = null;
  for (const line of markLines) {
    if (isLikelyMark(line.label, known)) {
      current = {
        mark: line.label,
        cartons: line.cartons,
        weight: line.weight,
        shops: [],
      };
      marks.push(current);
      continue;
    }
    if (current) {
      current.shops.push({
        shop: line.label,
        cartons: line.cartons,
        weight: line.weight,
      });
    }
  }

  return {
    text,
    drCode: drMatch
      ? drMatch[0].toUpperCase().replace("-", "").replace(/\s+/g, "")
      : null,
    totalCartons: totalMatch ? parseNumber(totalMatch[1]) : null,
    totalWeight: totalMatch ? parseNumber(totalMatch[2]) : null,
    marks,
    markLines,
    hasRussianHeaders:
      /Названия строк/i.test(text) && /Сумма по полю Cartons/i.test(text),
    hasGrandTotalLabel: /Общий итог/i.test(text),
  };
}
