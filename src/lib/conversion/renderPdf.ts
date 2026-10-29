import fs from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fontsDir } from "../paths";
import type { PivotResult } from "../types";
import { formatNumber } from "./normalize";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const TABLE_LEFT = MARGIN;
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COL_NAME_X = TABLE_LEFT + 8;
const COL_NAME_MAX = 300;
const COL_CARTONS_RIGHT = TABLE_LEFT + 400;
const COL_WEIGHT_RIGHT = TABLE_LEFT + TABLE_WIDTH - 12;
const ROW_H = 18;
const HEADER_H = 22;

const COLORS = {
  ink: rgb(0.08, 0.12, 0.16),
  headerBg: rgb(0.06, 0.35, 0.36),
  headerText: rgb(1, 1, 1),
  // Strict adjacent contrast: every data row flips between these two
  zebraA: rgb(0.86, 0.94, 0.92),
  zebraB: rgb(0.93, 0.95, 0.98),
  totalBg: rgb(0.98, 0.90, 0.55),
  amountMark: rgb(0.05, 0.28, 0.3),
  amountShop: rgb(0.15, 0.22, 0.35),
  amountTotal: rgb(0.45, 0.22, 0.02),
  grid: rgb(0.72, 0.78, 0.82),
  note: rgb(0.55, 0.05, 0.05),
  commentBox: rgb(1, 0.97, 0.92),
  commentBorder: rgb(0.85, 0.7, 0.45),
};

async function loadFonts(doc: PDFDocument) {
  doc.registerFontkit(fontkit as never);
  const regularBytes = fs.readFileSync(
    path.join(fontsDir(), "NotoSans-Regular.ttf"),
  );
  const boldBytes = fs.readFileSync(path.join(fontsDir(), "NotoSans-Bold.ttf"));
  const regular = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  return { regular, bold };
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (
    truncated.length > 1 &&
    font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

function drawRightText(
  page: PDFPage,
  text: string,
  rightX: number,
  baselineY: number,
  size: number,
  font: PDFFont,
  color: RGB,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: rightX - width,
    y: baselineY,
    size,
    font,
    color,
  });
}

export type PdfVariant = "office" | "driver";

export async function renderPivotPdf(
  pivot: PivotResult,
  comments: string,
  variant: PdfVariant = "office",
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { regular, bold } = await loadFonts(doc);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  let stripe = 0;
  // Sea driver sample is "DR1249-". Air driver sample is "AR090 -".
  const title =
    variant === "driver"
      ? /^AR/i.test(pivot.drCode)
        ? `${pivot.drCode} -`
        : `${pivot.drCode}-`
      : pivot.drCode;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawColumnGuides();
    }
  };

  const drawColumnGuides = () => {
    // Light vertical separators so names never visually collide with amounts
    const cartonDivider = COL_CARTONS_RIGHT - 70;
    const weightDivider = COL_WEIGHT_RIGHT - 80;
    for (const x of [cartonDivider, weightDivider]) {
      page.drawLine({
        start: { x, y: MARGIN },
        end: { x, y: PAGE_HEIGHT - MARGIN },
        thickness: 0.4,
        color: COLORS.grid,
        opacity: 0.35,
      });
    }
  };

  const drawRow = (opts: {
    label: string;
    cartons: string;
    weight: string;
    kind: "mark" | "shop" | "total" | "header";
    indent?: number;
  }) => {
    const height = opts.kind === "header" ? HEADER_H : ROW_H;
    ensureSpace(height + 2);

    let bg: RGB = COLORS.zebraA;
    let labelFont = regular;
    let amountFont = regular;
    let labelColor = COLORS.ink;
    let amountColor = COLORS.amountShop;
    let size = 10;

    if (opts.kind === "header") {
      bg = COLORS.headerBg;
      labelFont = bold;
      amountFont = bold;
      labelColor = COLORS.headerText;
      amountColor = COLORS.headerText;
      size = 9;
    } else if (opts.kind === "total") {
      bg = COLORS.totalBg;
      labelFont = bold;
      amountFont = bold;
      amountColor = COLORS.amountTotal;
      size = 11;
    } else {
      // Mark and shop rows share one zebra sequence so each line differs from the next
      bg = stripe % 2 === 0 ? COLORS.zebraA : COLORS.zebraB;
      if (opts.kind === "mark") {
        labelFont = bold;
        amountFont = bold;
        amountColor = COLORS.amountMark;
        size = 11;
      } else {
        amountColor = COLORS.amountShop;
        size = 10;
      }
      stripe += 1;
    }

    const rowBottom = y - height;
    page.drawRectangle({
      x: TABLE_LEFT,
      y: rowBottom,
      width: TABLE_WIDTH,
      height,
      color: bg,
    });

    page.drawLine({
      start: { x: TABLE_LEFT, y: rowBottom },
      end: { x: TABLE_LEFT + TABLE_WIDTH, y: rowBottom },
      thickness: 0.35,
      color: COLORS.grid,
    });

    const baseline = rowBottom + (height - size) / 2;
    const indent = opts.indent ?? 0;
    const label = fitText(
      opts.label,
      labelFont,
      size,
      COL_NAME_MAX - indent,
    );
    page.drawText(label, {
      x: COL_NAME_X + indent,
      y: baseline,
      size,
      font: labelFont,
      color: labelColor,
    });

    drawRightText(
      page,
      opts.cartons,
      COL_CARTONS_RIGHT,
      baseline,
      size,
      amountFont,
      amountColor,
    );
    drawRightText(
      page,
      opts.weight,
      COL_WEIGHT_RIGHT,
      baseline,
      size,
      amountFont,
      amountColor,
    );

    y = rowBottom;
  };

  // Title + Russian column labels (kept as full phrases for sample/agent match)
  page.drawText(title, {
    x: COL_NAME_X,
    y: y - 16,
    size: 18,
    font: bold,
    color: COLORS.ink,
  });
  y -= 28;
  page.drawText(
    "Названия строк          Сумма по полю Cartons          Сумма по полю Weight",
    {
      x: COL_NAME_X,
      y: y - 10,
      size: 8,
      font: regular,
      color: COLORS.ink,
    },
  );
  y -= 18;
  drawColumnGuides();

  drawRow({
    kind: "header",
    label: "Названия строк",
    cartons: "Cartons",
    weight: "Weight",
  });

  for (const mark of pivot.marks) {
    drawRow({
      kind: "mark",
      label: mark.displayMark,
      cartons: formatNumber(mark.cartons),
      weight: formatNumber(mark.weight),
    });
    for (const shop of mark.shops) {
      drawRow({
        kind: "shop",
        label: shop.shop,
        cartons: formatNumber(shop.cartons),
        weight: formatNumber(shop.weight),
        indent: 14,
      });
    }
  }

  drawRow({
    kind: "total",
    label: "Общий итог",
    cartons: formatNumber(pivot.totalCartons),
    weight: formatNumber(pivot.totalWeight),
  });

  // Comment block under the table: extracted notes + human-written comments
  y -= 14;
  const extractedLines = pivot.palletNote
    ? wrapText(`Примечание (from Excel): ${pivot.palletNote}`, 86)
    : ["Примечание (from Excel): —"];
  const humanLines = comments.trim()
    ? wrapText(`КОММЕНТАРИИ: ${comments.trim()}`, 86)
    : [
        "КОММЕНТАРИИ:",
        "________________________________________________________________",
        "________________________________________________________________",
      ];
  const commentLines = [...extractedLines, "", ...humanLines];
  const boxHeight = Math.max(72, commentLines.length * 13 + 28);
  ensureSpace(boxHeight + 8);
  const boxBottom = y - boxHeight;
  page.drawRectangle({
    x: TABLE_LEFT,
    y: boxBottom,
    width: TABLE_WIDTH,
    height: boxHeight,
    color: COLORS.commentBox,
    borderColor: COLORS.commentBorder,
    borderWidth: 1,
  });
  page.drawText("Comments / КОММЕНТАРИИ (write below)", {
    x: COL_NAME_X,
    y: y - 14,
    size: 10,
    font: bold,
    color: COLORS.note,
  });
  let textY = y - 28;
  for (const line of commentLines) {
    if (textY < boxBottom + 10) break;
    page.drawText(line || " ", {
      x: COL_NAME_X,
      y: textY,
      size: 9,
      font: regular,
      color: COLORS.note,
    });
    textY -= 13;
  }
  y = boxBottom;

  return doc.save();
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
