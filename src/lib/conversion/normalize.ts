export function normalizeDrCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = cleaned.match(/^(DR|AR)-?(\d+)/i);
  if (match) return `${match[1].toUpperCase()}${match[2]}`;
  return cleaned.replace(/-/g, "");
}

export function drCodeFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return normalizeDrCode(base);
}

export function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1).replace(".", ",");
}

export function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
