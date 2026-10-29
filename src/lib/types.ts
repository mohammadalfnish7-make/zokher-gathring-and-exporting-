export type LineItem = {
  no: number;
  mark: string;
  shop: string;
  systemCode: string;
  cartons: number;
  weight: number;
};

export type ShopAggregate = {
  shop: string;
  cartons: number;
  weight: number;
};

export type MarkAggregate = {
  mark: string;
  displayMark: string;
  cartons: number;
  weight: number;
  shops: ShopAggregate[];
};

export type PivotResult = {
  drCode: string;
  lines: LineItem[];
  marks: MarkAggregate[];
  totalCartons: number;
  totalWeight: number;
  palletNote: string;
};

export type VerificationError = {
  field: string;
  expected: string;
  actual: string;
  severity: "error" | "warning";
};

export type VerificationResult = {
  confidence: number;
  errors: VerificationError[];
  fixSteps: string[];
  summary: string;
  excelFacts: Record<string, unknown>;
  pdfFacts: Record<string, unknown>;
};
