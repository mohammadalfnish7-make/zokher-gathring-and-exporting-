import type { PivotResult, VerificationError } from "../types";
import type { PdfFacts } from "./extractPdfFacts";
import { round1 } from "./pivot";

function nearlyEqual(a: number, b: number, eps = 0.05): boolean {
  return Math.abs(a - b) <= eps;
}

function normalizeLabel(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function deterministicCompare(
  pivot: PivotResult,
  pdf: PdfFacts,
): VerificationError[] {
  const errors: VerificationError[] = [];

  if (!pdf.hasRussianHeaders) {
    errors.push({
      field: "headers",
      expected: "Названия строк / Сумма по полю Cartons / Weight",
      actual: "missing Russian headers",
      severity: "error",
    });
  }

  if (!pdf.hasGrandTotalLabel) {
    errors.push({
      field: "grand_total_label",
      expected: "Общий итог",
      actual: "missing",
      severity: "error",
    });
  }

  const expectedDr = pivot.drCode.toUpperCase().replace("-", "");
  if (!pdf.drCode || pdf.drCode.toUpperCase().replace("-", "") !== expectedDr) {
    errors.push({
      field: "drCode",
      expected: expectedDr,
      actual: pdf.drCode ?? "missing",
      severity: "error",
    });
  }

  if (
    pdf.totalCartons == null ||
    !nearlyEqual(pdf.totalCartons, pivot.totalCartons)
  ) {
    errors.push({
      field: "totalCartons",
      expected: String(round1(pivot.totalCartons)),
      actual: pdf.totalCartons == null ? "missing" : String(pdf.totalCartons),
      severity: "error",
    });
  }

  if (
    pdf.totalWeight == null ||
    !nearlyEqual(pdf.totalWeight, pivot.totalWeight)
  ) {
    errors.push({
      field: "totalWeight",
      expected: String(round1(pivot.totalWeight)),
      actual: pdf.totalWeight == null ? "missing" : String(pdf.totalWeight),
      severity: "error",
    });
  }

  for (const mark of pivot.marks) {
    const found = pdf.marks.find(
      (m) =>
        normalizeLabel(m.mark) === normalizeLabel(mark.displayMark) ||
        normalizeLabel(m.mark) === normalizeLabel(mark.mark),
    );
    if (!found) {
      errors.push({
        field: `mark.${mark.mark}`,
        expected: `${mark.displayMark} ${round1(mark.cartons)} ${round1(mark.weight)}`,
        actual: "missing from PDF",
        severity: "error",
      });
      continue;
    }
    if (
      !nearlyEqual(found.cartons, mark.cartons) ||
      !nearlyEqual(found.weight, mark.weight)
    ) {
      errors.push({
        field: `mark.${mark.mark}.totals`,
        expected: `${round1(mark.cartons)} / ${round1(mark.weight)}`,
        actual: `${found.cartons} / ${found.weight}`,
        severity: "error",
      });
    }

    for (const shop of mark.shops) {
      const shopFound = found.shops.find(
        (s) => normalizeLabel(s.shop) === normalizeLabel(shop.shop),
      );
      if (!shopFound) {
        errors.push({
          field: `shop.${mark.mark}.${shop.shop}`,
          expected: `${shop.shop} ${round1(shop.cartons)} ${round1(shop.weight)}`,
          actual: "missing from PDF",
          severity: "error",
        });
      } else if (
        !nearlyEqual(shopFound.cartons, shop.cartons) ||
        !nearlyEqual(shopFound.weight, shop.weight)
      ) {
        errors.push({
          field: `shop.${mark.mark}.${shop.shop}.totals`,
          expected: `${round1(shop.cartons)} / ${round1(shop.weight)}`,
          actual: `${shopFound.cartons} / ${shopFound.weight}`,
          severity: "error",
        });
      }
    }
  }

  return errors;
}

export function confidenceFromErrors(errors: VerificationError[]): number {
  const hard = errors.filter((e) => e.severity === "error");
  if (hard.length === 0) return 100;
  return Math.max(0, 100 - hard.length * 10);
}
