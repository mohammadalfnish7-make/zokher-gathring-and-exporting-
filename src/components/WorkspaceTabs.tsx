"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConversionEditor } from "./ConversionEditor";
import type { SerializedConversion } from "@/lib/conversion/serialize";

export function WorkspaceTabs({
  conversions,
}: {
  conversions: SerializedConversion[];
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(conversions[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => conversions.find((c) => c.id === activeId) ?? conversions[0],
    [activeId, conversions],
  );

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const ids = conversions.map((c) => c.id);
      for (const file of Array.from(files)) {
        const data = new FormData();
        data.append("file", file);
        const res = await fetch("/api/conversions", {
          method: "POST",
          body: data,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed: ${file.name}`);
        ids.push(json.id);
      }
      router.push(`/workspace?ids=${ids.join(",")}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (!active) {
    return (
      <div className="panel p-6 text-sm text-[var(--muted)]">
        No files in this workspace.{" "}
        <Link href="/" className="text-[var(--accent)]">
          Upload Excel files
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="conversion-page flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2">
        <Link
          href="/history"
          className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← History
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {conversions.map((c) => {
            const selected = c.id === active.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--accent-soft)]"
                }`}
                title={`${c.sourceFilename} · ${c.status}`}
              >
                <span className="truncate">{c.drCode}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] uppercase ${
                    selected
                      ? "bg-white/20 text-white"
                      : "bg-stone-100 text-[var(--muted)]"
                  }`}
                >
                  {c.status.replace("_", " ")}
                </span>
              </button>
            );
          })}
        </div>
        <label className="btn btn-secondary !cursor-pointer !px-3 !py-1.5 text-xs">
          {busy ? "Adding…" : "+ Add files"}
          <input
            type="file"
            accept=".xlsx,.xls"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error ? (
        <p className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ConversionEditor
          key={active.id}
          conversion={active}
          embedded
          workspaceIds={conversions.map((c) => c.id)}
        />
      </div>
    </div>
  );
}
