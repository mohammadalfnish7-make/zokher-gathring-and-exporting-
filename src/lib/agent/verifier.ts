import { Annotation, StateGraph, END, START } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { parseExcelBuffer } from "../conversion/parseExcel";
import { buildPivot, type MarkAliases } from "../conversion/pivot";
import { extractPdfFacts, type PdfFacts } from "../conversion/extractPdfFacts";
import {
  confidenceFromErrors,
  deterministicCompare,
} from "../conversion/compare";
import type { PivotResult, VerificationError, VerificationResult } from "../types";

export type AgentTraceMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  rawJson?: unknown;
};

const VerifierState = Annotation.Root({
  excelBuffer: Annotation<Buffer>,
  filename: Annotation<string>,
  pdfBytes: Annotation<Uint8Array>,
  markAliases: Annotation<MarkAliases>,
  comments: Annotation<string>,
  pivot: Annotation<PivotResult | null>,
  pdfFacts: Annotation<PdfFacts | null>,
  errors: Annotation<VerificationError[]>,
  confidence: Annotation<number>,
  summary: Annotation<string>,
  fixSteps: Annotation<string[]>,
  messages: Annotation<AgentTraceMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

const AdviceSchema = z.object({
  summary: z.string(),
  fixSteps: z.array(z.string()),
});

function excelFactsFromPivot(pivot: PivotResult) {
  return {
    drCode: pivot.drCode,
    lineCount: pivot.lines.length,
    markCount: pivot.marks.length,
    totalCartons: pivot.totalCartons,
    totalWeight: pivot.totalWeight,
    marks: pivot.marks.map((m) => ({
      mark: m.mark,
      displayMark: m.displayMark,
      cartons: m.cartons,
      weight: m.weight,
      shops: m.shops,
    })),
    palletNote: pivot.palletNote,
  };
}

async function loadArtifacts(state: typeof VerifierState.State) {
  return {
    messages: [
      {
        role: "system" as const,
        content:
          "Verifier started. Will parse Excel, extract PDF facts, compare deterministically, then ask Anthropic for fix guidance.",
      },
    ],
  };
}

async function extractExcelFacts(state: typeof VerifierState.State) {
  const parsed = parseExcelBuffer(state.excelBuffer, state.filename);
  const pivot = buildPivot(
    parsed.drCode,
    parsed.lines,
    parsed.palletNote,
    state.markAliases || {},
  );
  const facts = excelFactsFromPivot(pivot);
  return {
    pivot,
    messages: [
      {
        role: "tool" as const,
        content: "extract_excel_facts",
        rawJson: facts,
      },
    ],
  };
}

async function extractPdfNode(state: typeof VerifierState.State) {
  const knownMarks = state.pivot?.marks.map((m) => m.mark) || [];
  const pdfFacts = await extractPdfFacts(state.pdfBytes, knownMarks);
  return {
    pdfFacts,
    messages: [
      {
        role: "tool" as const,
        content: "extract_pdf_facts",
        rawJson: {
          drCode: pdfFacts.drCode,
          totalCartons: pdfFacts.totalCartons,
          totalWeight: pdfFacts.totalWeight,
          hasRussianHeaders: pdfFacts.hasRussianHeaders,
          hasGrandTotalLabel: pdfFacts.hasGrandTotalLabel,
          markCount: pdfFacts.marks.length,
          markLineCount: pdfFacts.markLines.length,
          textPreview: pdfFacts.text.slice(0, 1500),
        },
      },
    ],
  };
}

async function compareNode(state: typeof VerifierState.State) {
  if (!state.pivot || !state.pdfFacts) {
    return {
      errors: [
        {
          field: "artifacts",
          expected: "pivot + pdf facts",
          actual: "missing",
          severity: "error" as const,
        },
      ],
      confidence: 0,
      messages: [
        {
          role: "tool" as const,
          content: "compare_failed_missing_artifacts",
        },
      ],
    };
  }
  const errors = deterministicCompare(state.pivot, state.pdfFacts);
  const confidence = confidenceFromErrors(errors);
  return {
    errors,
    confidence,
    messages: [
      {
        role: "tool" as const,
        content: "compare",
        rawJson: { confidence, errorCount: errors.length, errors },
      },
    ],
  };
}

async function scoreAndAdvise(state: typeof VerifierState.State) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const modelName = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

  if (state.confidence === 100) {
    const summary =
      "Excel and PDF totals match. Conversion verified at 100% confidence.";
    return {
      summary,
      fixSteps: [] as string[],
      messages: [
        {
          role: "assistant" as const,
          content: summary,
          rawJson: { confidence: 100, errors: [], fixSteps: [] },
        },
      ],
    };
  }

  // Without API key, still return deterministic result + generic fix steps
  if (!apiKey) {
    const fixSteps = state.errors.map(
      (e) =>
        `Fix ${e.field}: expected "${e.expected}", got "${e.actual}". Update mark aliases/comments or regenerate the PDF.`,
    );
    const summary = `Verification confidence ${state.confidence}%. ${state.errors.length} mismatch(es) found (Anthropic key not set; using deterministic advice).`;
    return {
      summary,
      fixSteps,
      messages: [
        {
          role: "assistant" as const,
          content: summary,
          rawJson: {
            confidence: state.confidence,
            errors: state.errors,
            fixSteps,
            model: "deterministic-fallback",
          },
        },
      ],
    };
  }

  const model = new ChatAnthropic({
    apiKey,
    model: modelName,
    temperature: 0,
  });

  const userPayload = {
    confidence: state.confidence,
    errors: state.errors,
    excelFacts: state.pivot ? excelFactsFromPivot(state.pivot) : null,
    pdfFacts: state.pdfFacts
      ? {
          drCode: state.pdfFacts.drCode,
          totalCartons: state.pdfFacts.totalCartons,
          totalWeight: state.pdfFacts.totalWeight,
          markLines: state.pdfFacts.markLines.slice(0, 80),
          textPreview: state.pdfFacts.text.slice(0, 2000),
        }
      : null,
    comments: state.comments,
  };

  const prompt = `You verify Fragrance World / Zokher DR Excel→PDF conversions.
Deterministic checks already computed confidence=${state.confidence} and the errors list.
Return JSON with:
- summary: short operator-facing summary
- fixSteps: concrete UI steps to reach 100% (edit mark aliases, comments, re-upload Excel, regenerate PDF)

Do not invent numeric mismatches beyond the provided errors.
Payload:
${JSON.stringify(userPayload, null, 2)}`;

  const response = await model.invoke([
    {
      role: "system",
      content:
        "You are a careful logistics document verifier. Reply with valid JSON only matching {summary:string, fixSteps:string[]}.",
    },
    { role: "user", content: prompt },
  ]);

  const rawText =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  let advice = {
    summary: `Confidence ${state.confidence}%. Review mismatches and fix.`,
    fixSteps: state.errors.map(
      (e) => `Resolve ${e.field}: expected ${e.expected}, actual ${e.actual}`,
    ),
  };

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      advice = AdviceSchema.parse(JSON.parse(jsonMatch[0]));
    }
  } catch {
    // keep fallback advice
  }

  return {
    summary: advice.summary,
    fixSteps: advice.fixSteps,
    messages: [
      {
        role: "user" as const,
        content: prompt,
        rawJson: userPayload,
      },
      {
        role: "assistant" as const,
        content: rawText,
        rawJson: {
          confidence: state.confidence,
          errors: state.errors,
          fixSteps: advice.fixSteps,
          summary: advice.summary,
          model: modelName,
        },
      },
    ],
  };
}

export function buildVerifierGraph() {
  return new StateGraph(VerifierState)
    .addNode("load_artifacts", loadArtifacts)
    .addNode("extract_excel_facts", extractExcelFacts)
    .addNode("extract_pdf_facts", extractPdfNode)
    .addNode("compare", compareNode)
    .addNode("score_and_advise", scoreAndAdvise)
    .addEdge(START, "load_artifacts")
    .addEdge("load_artifacts", "extract_excel_facts")
    .addEdge("extract_excel_facts", "extract_pdf_facts")
    .addEdge("extract_pdf_facts", "compare")
    .addEdge("compare", "score_and_advise")
    .addEdge("score_and_advise", END)
    .compile();
}

export async function runVerifier(input: {
  excelBuffer: Buffer;
  filename: string;
  pdfBytes: Uint8Array;
  markAliases?: MarkAliases;
  comments?: string;
}): Promise<{
  result: VerificationResult;
  messages: AgentTraceMessage[];
  model: string;
}> {
  const graph = buildVerifierGraph();
  const finalState = await graph.invoke({
    excelBuffer: input.excelBuffer,
    filename: input.filename,
    pdfBytes: input.pdfBytes,
    markAliases: input.markAliases || {},
    comments: input.comments || "",
    pivot: null,
    pdfFacts: null,
    errors: [],
    confidence: 0,
    summary: "",
    fixSteps: [],
    messages: [],
  });

  const model =
    process.env.ANTHROPIC_API_KEY
      ? process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929"
      : "deterministic-fallback";

  return {
    model,
    messages: finalState.messages,
    result: {
      confidence: finalState.confidence,
      errors: finalState.errors,
      fixSteps: finalState.fixSteps,
      summary: finalState.summary,
      excelFacts: finalState.pivot
        ? excelFactsFromPivot(finalState.pivot)
        : {},
      pdfFacts: finalState.pdfFacts
        ? {
            drCode: finalState.pdfFacts.drCode,
            totalCartons: finalState.pdfFacts.totalCartons,
            totalWeight: finalState.pdfFacts.totalWeight,
          }
        : {},
    },
  };
}
