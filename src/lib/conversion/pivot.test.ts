import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseExcelBuffer } from "./parseExcel";
import { buildPivot, round1, toDriverPivot } from "./pivot";
import { renderPivotPdf } from "./renderPdf";
import { extractPdfFacts } from "./extractPdfFacts";
import { deterministicCompare, confidenceFromErrors } from "./compare";

const dataDir = path.join(process.cwd(), "data");
const airDir = path.join(process.cwd(), "data air");

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

describe("Air AR090", () => {
  function airPivot() {
    const buf = fs.readFileSync(path.join(airDir, "AR090.xlsx"));
    const parsed = parseExcelBuffer(buf, "AR090.xlsx");
    return buildPivot(parsed.drCode, parsed.lines, parsed.palletNote);
  }

  it("reads ON THE FLOOR and matches the office PDF totals", () => {
    const buf = fs.readFileSync(path.join(airDir, "AR090.xlsx"));
    const parsed = parseExcelBuffer(buf, "AR090.xlsx");
    const pivot = buildPivot(parsed.drCode, parsed.lines, parsed.palletNote);
    expect(parsed.sheetName.trim()).toBe("ON THE FLOOR");
    expect(parsed.lines).toHaveLength(16);
    expect(pivot.drCode).toBe("AR090");
    expect(pivot.totalCartons).toBe(83);
    expect(pivot.totalWeight).toBe(2141);
    const tl1766 = pivot.marks.find((m) => m.mark === "TL1766");
    expect(tl1766?.cartons).toBe(43);
    expect(tl1766?.weight).toBe(1104.5);
    expect(tl1766?.shops.map((s) => s.shop)[0]).toBe("ADAN BREEZE");
    expect(pivot.marks.find((m) => m.mark === "TL2009")?.shops[0]?.shop).toBe(
      "N/A",
    );
  });

  it("driver pivot keeps TL marks and merges shops", () => {
    const driver = toDriverPivot(airPivot());
    expect(driver.marks.map((m) => m.displayMark)).toEqual([
      "TL1766",
      "TL2009",
      "TL6780",
      "TL7075",
      "TL8134",
      "TL8939",
    ]);
    expect(driver.marks.every((m) => m.shops[0]?.shop === "N/A")).toBe(true);
    expect(driver.totalCartons).toBe(83);
  });

  it("office and driver PDFs match the air sample shape", async () => {
    const pivot = airPivot();
    const office = await renderPivotPdf(pivot, "", "office");
    const driver = await renderPivotPdf(toDriverPivot(pivot), "", "driver");
    const officeFacts = await extractPdfFacts(
      office,
      pivot.marks.map((m) => m.mark),
    );
    const driverFacts = await extractPdfFacts(
      driver,
      pivot.marks.map((m) => m.mark),
    );
    expect(deterministicCompare(pivot, officeFacts)).toEqual([]);
    expect(officeFacts.drCode).toBe("AR090");
    expect(officeFacts.text).toContain("CROWN STAR");
    expect(driverFacts.totalCartons).toBe(83);
    expect(driverFacts.totalWeight).toBe(2141);
    expect(driverFacts.text).toContain("AR090 -");
    expect(driverFacts.text).toContain("N/A");
    expect(driverFacts.text).not.toContain("CROWN STAR");
  }, 30000);
});
