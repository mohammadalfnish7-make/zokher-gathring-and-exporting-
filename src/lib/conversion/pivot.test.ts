import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseExcelBuffer } from "./parseExcel";
import { buildPivot, round1, toDriverPivot } from "./pivot";
import { renderPivotPdf } from "./renderPdf";
import { extractPdfFacts } from "./extractPdfFacts";
import { deterministicCompare, confidenceFromErrors } from "./compare";

const dataDir = path.join(process.cwd(), "data");

describe("Excel pivot fixtures", () => {
  it("DR-1249 totals match sample PDF", () => {
    const buf = fs.readFileSync(path.join(dataDir, "DR-1249.xlsx"));
    const parsed = parseExcelBuffer(buf, "DR-1249.xlsx");
    const pivot = buildPivot(parsed.drCode, parsed.lines, parsed.palletNote, {
      "5550": "EM5550",
    });
    expect(pivot.drCode).toBe("DR1249");
    expect(pivot.totalCartons).toBe(1000);
    expect(round1(pivot.totalWeight)).toBe(20417.5);
    const m5550 = pivot.marks.find((m) => m.mark === "5550");
    expect(m5550?.displayMark).toBe("EM5550");
    expect(m5550?.cartons).toBe(99);
  });

  it("DR-1249 driver pivot merges shops into N/A", () => {
    const buf = fs.readFileSync(path.join(dataDir, "DR-1249.xlsx"));
    const parsed = parseExcelBuffer(buf, "DR-1249.xlsx");
    const pivot = buildPivot(parsed.drCode, parsed.lines, parsed.palletNote, {
      "5550": "EM5550",
    });
    const driver = toDriverPivot(pivot);
    const mark1333 = driver.marks.find((m) => m.mark === "1333");
    expect(mark1333?.shops).toEqual([
      { shop: "N/A", cartons: 244, weight: 2673 },
    ]);
    expect(driver.marks.every((m) => m.shops.length === 1)).toBe(true);
    expect(driver.marks.every((m) => m.shops[0]?.shop === "N/A")).toBe(true);
    expect(driver.totalCartons).toBe(1000);
  });

  it("DR-1250 totals match sample PDF", () => {
    const buf = fs.readFileSync(path.join(dataDir, "DR-1250.xlsx"));
    const parsed = parseExcelBuffer(buf, "DR-1250.xlsx");
    const pivot = buildPivot(parsed.drCode, parsed.lines, parsed.palletNote);
    expect(pivot.drCode).toBe("DR1250");
    expect(pivot.totalCartons).toBe(476);
    expect(round1(pivot.totalWeight)).toBe(11655.9);
  });
});

describe("PDF round-trip verification", () => {
  it("generated DR-1250 PDF verifies at 100%", async () => {
    const buf = fs.readFileSync(path.join(dataDir, "DR-1250.xlsx"));
    const parsed = parseExcelBuffer(buf, "DR-1250.xlsx");
    const pivot = buildPivot(parsed.drCode, parsed.lines, parsed.palletNote);
    const pdfBytes = await renderPivotPdf(pivot, "");
    const facts = await extractPdfFacts(
      pdfBytes,
      pivot.marks.map((m) => m.mark),
    );
    const errors = deterministicCompare(pivot, facts);
    expect(errors).toEqual([]);
    expect(confidenceFromErrors(errors)).toBe(100);
  }, 30000);

  it("generated DR-1249 PDF verifies at 100% with mark aliases", async () => {
    const buf = fs.readFileSync(path.join(dataDir, "DR-1249.xlsx"));
    const parsed = parseExcelBuffer(buf, "DR-1249.xlsx");
    const pivot = buildPivot(parsed.drCode, parsed.lines, parsed.palletNote, {
      "5550": "EM5550",
    });
    const pdfBytes = await renderPivotPdf(pivot, "");
    const facts = await extractPdfFacts(
      pdfBytes,
      pivot.marks.map((m) => m.mark),
    );
    const errors = deterministicCompare(pivot, facts);
    expect(errors).toEqual([]);
    expect(confidenceFromErrors(errors)).toBe(100);
  }, 30000);

  it("generated DR-1249 driver PDF has N/A shop lines and mark totals", async () => {
    const buf = fs.readFileSync(path.join(dataDir, "DR-1249.xlsx"));
    const parsed = parseExcelBuffer(buf, "DR-1249.xlsx");
    const pivot = buildPivot(parsed.drCode, parsed.lines, parsed.palletNote, {
      "5550": "EM5550",
    });
    const pdfBytes = await renderPivotPdf(toDriverPivot(pivot), "", "driver");
    const facts = await extractPdfFacts(
      pdfBytes,
      pivot.marks.map((m) => m.mark),
    );
    expect(facts.drCode?.replace(/-$/, "")).toBe("DR1249");
    expect(facts.totalCartons).toBe(1000);
    expect(facts.totalWeight).toBe(20417.5);
    expect(facts.text).toContain("N/A");
    expect(facts.text).not.toContain("LA PERFUME");
    expect(facts.text).not.toContain("REEF PERFUME");
  }, 30000);
});
