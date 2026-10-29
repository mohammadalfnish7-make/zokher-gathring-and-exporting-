import type { LineItem, MarkAggregate, PivotResult } from "../types";

export type MarkAliases = Record<string, string>;

function compareMarks(a: string, b: string): number {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) return Number(a) - Number(b);
  if (aNum !== bNum) return aNum ? -1 : 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function buildPivot(
  drCode: string,
  lines: LineItem[],
  palletNote: string,
  markAliases: MarkAliases = {},
): PivotResult {
  const byMark = new Map<string, Map<string, { cartons: number; weight: number }>>();

  for (const line of lines) {
    const mark = line.mark.trim();
    const shop = line.shop.trim();
    if (!mark || !shop) continue;
    if (!byMark.has(mark)) byMark.set(mark, new Map());
    const shops = byMark.get(mark)!;
    const prev = shops.get(shop) || { cartons: 0, weight: 0 };
    shops.set(shop, {
      cartons: round1(prev.cartons + line.cartons),
      weight: round1(prev.weight + line.weight),
    });
  }

  const marks: MarkAggregate[] = [...byMark.entries()]
    .sort(([a], [b]) => compareMarks(a, b))
    .map(([mark, shopsMap]) => {
      const shops = [...shopsMap.entries()]
        .map(([shop, totals]) => ({
          shop,
          cartons: round1(totals.cartons),
          weight: round1(totals.weight),
        }))
        .sort((a, b) =>
          a.shop.localeCompare(b.shop, undefined, { sensitivity: "base" }),
        );
      const cartons = round1(shops.reduce((s, x) => s + x.cartons, 0));
      const weight = round1(shops.reduce((s, x) => s + x.weight, 0));
      return {
        mark,
        displayMark: markAliases[mark] || mark,
        cartons,
        weight,
        shops,
      };
    });

  return {
    drCode,
    lines,
    marks,
    totalCartons: round1(marks.reduce((s, m) => s + m.cartons, 0)),
    totalWeight: round1(marks.reduce((s, m) => s + m.weight, 0)),
    palletNote,
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Driver PDF: keep TL/mark digits, drop shop names, merge shops into one N/A line. */
export function toDriverPivot(pivot: PivotResult): PivotResult {
  return {
    ...pivot,
    marks: pivot.marks.map((mark) => ({
      ...mark,
      shops: [
        {
          shop: "N/A",
          cartons: mark.cartons,
          weight: mark.weight,
        },
      ],
    })),
  };
}
