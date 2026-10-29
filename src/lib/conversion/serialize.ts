import type { Conversion, ConversionEdit, AgentRun } from "@prisma/client";

type ConversionWithRelations = Conversion & {
  edits: ConversionEdit[];
  agentRuns: AgentRun[];
};

export function serializeConversion(conversion: ConversionWithRelations) {
  return {
    ...conversion,
    updatedAt: conversion.updatedAt.toISOString(),
    createdAt: conversion.createdAt.toISOString(),
    agentRuns: conversion.agentRuns.map((run) => ({
      ...run,
      createdAt: run.createdAt.toISOString(),
    })),
    edits: conversion.edits.map((edit) => ({
      ...edit,
      createdAt: edit.createdAt.toISOString(),
    })),
  };
}

export type SerializedConversion = ReturnType<typeof serializeConversion>;
