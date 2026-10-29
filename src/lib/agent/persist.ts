import fs from "fs/promises";
import { prisma } from "../db";
import { parseAliases } from "../conversion/service";
import { runVerifier } from "./verifier";

export async function verifyConversion(conversionId: string) {
  const conversion = await prisma.conversion.findUniqueOrThrow({
    where: { id: conversionId },
  });
  if (!conversion.pdfPath) {
    throw new Error("PDF not generated yet");
  }

  const excelBuffer = await fs.readFile(conversion.sourcePath);
  const pdfBytes = new Uint8Array(await fs.readFile(conversion.pdfPath));
  const { result, messages, model } = await runVerifier({
    excelBuffer,
    filename: conversion.sourceFilename,
    pdfBytes,
    markAliases: parseAliases(conversion.markAliasesJson),
    comments: conversion.comments,
  });

  const run = await prisma.agentRun.create({
    data: {
      conversionId,
      confidence: result.confidence,
      passed: result.confidence === 100,
      summary: result.summary,
      errorsJson: JSON.stringify(result.errors),
      fixStepsJson: JSON.stringify(result.fixSteps),
      model,
      messages: {
        create: messages.map((m, index) => ({
          role: m.role,
          content: m.content,
          rawJson: m.rawJson ? JSON.stringify(m.rawJson) : null,
          sequence: index,
        })),
      },
    },
    include: { messages: { orderBy: { sequence: "asc" } } },
  });

  await prisma.conversion.update({
    where: { id: conversionId },
    data: {
      status: result.confidence === 100 ? "verified" : "needs_fix",
    },
  });

  return { run, result };
}
