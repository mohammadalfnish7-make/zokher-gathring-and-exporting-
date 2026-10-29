"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { formatNumber } from "@/lib/conversion/normalize";
import type { SerializedConversion } from "@/lib/conversion/serialize";
import type { PivotResult, VerificationError } from "@/lib/types";

export function ConversionEditor({
  conversion,
  embedded = false,
}: {
  conversion: SerializedConversion;
  embedded?: boolean;
  workspaceIds?: string[];
}) {
  const router = useRouter();
  const pivot = useMemo(
    () => JSON.parse(conversion.pivotJson) as PivotResult,
    [conversion.pivotJson],
  );
  const [comments, setComments] = useState(conversion.comments);
  const [palletNote, setPalletNote] = useState(conversion.palletNote);
  const [aliasesText, setAliasesText] = useState(() => {
    try {
      return JSON.stringify(JSON.parse(conversion.markAliasesJson), null, 2);
    } catch {
      return conversion.markAliasesJson || "{}";
    }
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{
    confidence: number;
    summary: string;
    errors: VerificationError[];
    fixSteps: string[];
    runId?: string;
  } | null>(() => {
    const last = conversion.agentRuns[0];
    if (!last) return null;
    return {
      confidence: last.confidence,
      summary: last.summary,
      errors: JSON.parse(last.errorsJson) as VerificationError[],
      fixSteps: JSON.parse(last.fixStepsJson) as string[],
      runId: last.id,
    };
  });

  async function saveEdits() {
    setBusy("save");
    setError(null);
    try {
      let markAliases: Record<string, string> = {};
      try {
        markAliases = JSON.parse(aliasesText);
      } catch {
        throw new Error("Mark aliases must be valid JSON object");
      }
      const res = await fetch(`/api/conversions/${conversion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments, palletNote, markAliases }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    setBusy("regen");
    setError(null);
    try {
      const res = await fetch(`/api/conversions/${conversion.id}/regenerate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Regenerate failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setBusy("verify");
    setError(null);
    try {
      const res = await fetch(`/api/conversions/${conversion.id}/verify`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verify failed");
      setVerifyResult({
        confidence: json.result.confidence,
        summary: json.result.summary,
        errors: json.result.errors,
        fixSteps: json.result.fixSteps,
        runId: json.run.id,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setBusy(null);
    }
  }

  const latest = conversion.agentRuns[0];

  return (
    <div
      className={`flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden ${
        embedded ? "" : "conversion-page"
      }`}
    >
      <div className="conversion-hero shrink-0 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {!embedded ? (
            <Link
              href="/history"
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
            >
              ← History
            </Link>
          ) : null}
          <h1 className="text-xl font-semibold leading-none sm:text-2xl">
            {conversion.drCode}
          </h1>
          <StatusBadge status={conversion.status} />
          {latest ? (
            <span className="status-pill status-generated">
              confidence {latest.confidence}%
            </span>
          ) : null}
          <p className="w-full truncate text-xs text-[var(--muted)] sm:ml-auto sm:w-auto">
            {conversion.sourceFilename} · updated{" "}
            {new Date(conversion.updatedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {error ? (
        <p className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="grid shrink-0 gap-2 lg:grid-cols-2">
        <section className="panel space-y-1.5 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Mark aliases</h2>
            <button
              className="btn btn-primary !px-2.5 !py-1 text-xs"
              onClick={saveEdits}
              disabled={!!busy}
            >
              {busy === "save" ? "Saving…" : "Save"}
            </button>
          </div>
          <textarea
            className="h-11 w-full resize-none rounded-lg border border-[var(--line)] bg-white px-2 py-1 font-mono text-xs"
            value={aliasesText}
            onChange={(e) => setAliasesText(e.target.value)}
          />
        </section>

        <section className="panel space-y-1 overflow-hidden p-2.5">
          <h2 className="text-sm font-semibold">Agent verification</h2>
          {verifyResult ? (
            <div className="space-y-1 text-xs">
              <p
                className={
                  verifyResult.confidence === 100
                    ? "font-semibold text-[var(--ok)]"
                    : "font-semibold text-[var(--warn)]"
                }
              >
                Confidence: {verifyResult.confidence}%
                {verifyResult.confidence === 100
                  ? " · verified"
                  : " · needs fix"}
              </p>
              <p className="line-clamp-1 text-[var(--muted)]">
                {verifyResult.summary}
              </p>
              {verifyResult.runId ? (
                <Link
                  href={`/conversions/${conversion.id}/agent/${verifyResult.runId}`}
                  className="inline-flex text-[var(--accent)] hover:underline"
                >
                  Transcript →
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              No verification yet. Run the agent after generating the PDF.
            </p>
          )}
        </section>
      </div>

      <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden p-2.5">
        <h2 className="mb-1.5 shrink-0 text-sm font-semibold">Pivot preview</h2>
        <div className="pivot-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Названия строк</th>
                <th>Сумма по полю Cartons</th>
                <th>Сумма по полю Weight</th>
              </tr>
            </thead>
            <tbody>
              {pivot.marks.map((mark) => (
                <Fragment key={mark.mark}>
                  <tr className="mark-row data-row">
                    <td>{mark.displayMark}</td>
                    <td className="num">{formatNumber(mark.cartons)}</td>
                    <td className="num">{formatNumber(mark.weight)}</td>
                  </tr>
                  {mark.shops.map((shop) => (
                    <tr
                      key={`${mark.mark}-${shop.shop}`}
                      className="shop-row data-row"
                    >
                      <td>{shop.shop}</td>
                      <td className="num">{formatNumber(shop.cartons)}</td>
                      <td className="num">{formatNumber(shop.weight)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="total-row">
                <td>Общий итог</td>
                <td className="num">{formatNumber(pivot.totalCartons)}</td>
                <td className="num">{formatNumber(pivot.totalWeight)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <a
            className="btn btn-secondary !px-3 !py-1.5 text-sm"
            href={`/api/conversions/${conversion.id}/download?kind=pdf`}
          >
            Download PDF
          </a>
          <a
            className="btn btn-secondary !px-3 !py-1.5 text-sm"
            href={`/api/conversions/${conversion.id}/download?kind=excel`}
          >
            Download Excel
          </a>
          <button
            className="btn btn-secondary !px-3 !py-1.5 text-sm"
            onClick={regenerate}
            disabled={!!busy}
          >
            {busy === "regen" ? "Regenerating…" : "Regenerate PDF"}
          </button>
          <button
            className="btn btn-primary !px-3 !py-1.5 text-sm"
            onClick={verify}
            disabled={!!busy}
          >
            {busy === "verify" ? "Verifying…" : "Run agent verify"}
          </button>
        </div>

        <section className="w-full max-w-md rounded-xl border border-amber-200/80 bg-amber-50/70 p-2 shadow-sm sm:ml-auto">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-[var(--ink)]">Comments</h2>
            <button
              className="btn btn-primary !px-2.5 !py-1 text-xs"
              onClick={saveEdits}
              disabled={!!busy}
            >
              {busy === "save" ? "Saving…" : "Save to PDF"}
            </button>
          </div>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
            <label className="block space-y-0.5 text-[10px]">
              <span className="font-medium text-[var(--muted)]">Pallet note</span>
              <textarea
                className="h-10 w-full resize-none rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs"
                value={palletNote}
                onChange={(e) => setPalletNote(e.target.value)}
                placeholder="From Excel…"
              />
            </label>
            <label className="block space-y-0.5 text-[10px]">
              <span className="font-medium text-[var(--muted)]">
                Human comment
              </span>
              <textarea
                className="h-10 w-full resize-none rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Write notes…"
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
