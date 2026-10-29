import fs from "fs/promises";
import path from "path";
import { prisma } from "../db";
import { pdfsDir, uploadsDir } from "../paths";
import { parseExcelBuffer } from "./parseExcel";
import { buildPivot, type MarkAliases } from "./pivot";
import { renderPivotPdf } from "./renderPdf";
import type { PivotResult } from "../types";
import type { ConversionStatus } from "@prisma/client";

async function ensureDirs() {
  await fs.mkdir(uploadsDir(), { recursive: true });
  await fs.mkdir(pdfsDir(), { recursive: true });
}

export function parseAliases(json: string): MarkAliases {
  try {
    return JSON.parse(json || "{}") as MarkAliases;
  } catch {
    return {};
  }
}

export function parsePivot(json: string): PivotResult {
  return JSON.parse(json) as PivotResult;
}

export async function createConversionFromUpload(
  file: File,
): Promise<{ id: string }> {
  await ensureDirs();
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name || "upload.xlsx";
  const parsed = parseExcelBuffer(buffer, filename);
  const aliases: MarkAliases = {};
  // Default alias seen in sample PDF for mark 5550
  if (parsed.lines.some((l) => l.mark === "5550")) {
    aliases["5550"] = "EM5550";
  }
  const pivot = buildPivot(
    parsed.drCode,
    parsed.lines,
    parsed.palletNote,
    aliases,
  );
  // Prefill human comment field with any extra Excel Примечание values
  const initialComments = parsed.extractedComments.join("\n");

  const conversion = await prisma.conversion.create({
    data: {
      drCode: pivot.drCode,
      status: "draft",
      sourceFilename: filename,
      sourcePath: "",
      pivotJson: JSON.stringify(pivot),
      comments: initialComments,
      palletNote: pivot.palletNote,
      markAliasesJson: JSON.stringify(aliases),
    },
  });

  const sourcePath = path.join(uploadsDir(), `${conversion.id}.xlsx`);
  await fs.writeFile(sourcePath, buffer);
  const pdfBytes = await renderPivotPdf(pivot, initialComments);
  const pdfPath = path.join(pdfsDir(), `${conversion.id}.pdf`);
  await fs.writeFile(pdfPath, pdfBytes);

  await prisma.conversion.update({
    where: { id: conversion.id },
    data: {
      sourcePath,
      pdfPath,
      status: "generated",
    },
  });

  return { id: conversion.id };
}

export async function regeneratePdf(conversionId: string) {
  const conversion = await prisma.conversion.findUniqueOrThrow({
    where: { id: conversionId },
  });
  const buffer = await fs.readFile(conversion.sourcePath);
  const aliases = parseAliases(conversion.markAliasesJson);
  const parsed = parseExcelBuffer(buffer, conversion.sourceFilename);
  const pivot = buildPivot(
    parsed.drCode,
    parsed.lines,
    conversion.palletNote || parsed.palletNote,
    aliases,
  );
  const pdfBytes = await renderPivotPdf(pivot, conversion.comments);
  const pdfPath = conversion.pdfPath || path.join(pdfsDir(), `${conversion.id}.pdf`);
  await fs.writeFile(pdfPath, pdfBytes);

  return prisma.conversion.update({
    where: { id: conversionId },
    data: {
      drCode: pivot.drCode,
      pivotJson: JSON.stringify(pivot),
      pdfPath,
      status: "generated" as ConversionStatus,
    },
  });
}

export async function updateConversionFields(
  conversionId: string,
  input: {
    comments?: string;
    palletNote?: string;
    markAliases?: MarkAliases;
  },
) {
  const conversion = await prisma.conversion.findUniqueOrThrow({
    where: { id: conversionId },
  });

  const edits: { field: string; oldValue: string; newValue: string }[] = [];

  if (input.comments !== undefined && input.comments !== conversion.comments) {
    edits.push({
      field: "comments",
      oldValue: conversion.comments,
      newValue: input.comments,
    });
  }
  if (
    input.palletNote !== undefined &&
    input.palletNote !== conversion.palletNote
  ) {
    edits.push({
      field: "palletNote",
      oldValue: conversion.palletNote,
      newValue: input.palletNote,
    });
  }
  if (input.markAliases !== undefined) {
    const next = JSON.stringify(input.markAliases);
    if (next !== conversion.markAliasesJson) {
      edits.push({
        field: "markAliasesJson",
        oldValue: conversion.markAliasesJson,
        newValue: next,
      });
    }
  }

  await prisma.$transaction([
    ...edits.map((e) =>
      prisma.conversionEdit.create({
        data: { conversionId, ...e },
      }),
    ),
    prisma.conversion.update({
      where: { id: conversionId },
      data: {
        comments: input.comments ?? conversion.comments,
        palletNote: input.palletNote ?? conversion.palletNote,
        markAliasesJson:
          input.markAliases !== undefined
            ? JSON.stringify(input.markAliases)
            : conversion.markAliasesJson,
        status: "draft",
      },
    }),
  ]);

  return regeneratePdf(conversionId);
}
