"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setProgress(null);
    const form = e.currentTarget;
    const input = form.elements.namedItem("files") as HTMLInputElement | null;
    const files = input?.files ? Array.from(input.files) : [];
    if (files.length === 0) {
      setError("Choose one or more Excel files first.");
      return;
    }
    setBusy(true);
    try {
      const ids: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Converting ${i + 1} of ${files.length}: ${file.name}`);
        const data = new FormData();
        data.append("file", file);
        const res = await fetch("/api/conversions", {
          method: "POST",
          body: data,
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || `Failed to convert ${file.name}`);
        }
        ids.push(json.id);
      }
      if (ids.length === 1) {
        router.push(`/workspace?ids=${ids[0]}`);
      } else {
        router.push(`/workspace?ids=${ids.join(",")}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`panel space-y-3 ${compact ? "p-4" : "space-y-4 p-6"}`}
    >
      <div>
        <h2 className={`font-semibold ${compact ? "text-base" : "text-xl"}`}>
          Upload DR Excel
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Select one or many Excel files. Each file opens as its own tab with the
          same pivot, comments, and verify tools.
        </p>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-medium">
          Excel files (.xlsx) — multi select
        </span>
        <input
          type="file"
          name="files"
          accept=".xlsx,.xls"
          multiple
          className={`block w-full rounded-xl border border-dashed border-[var(--line)] bg-white text-sm file:mr-4 file:rounded-full file:border-0 file:bg-[var(--accent-soft)] file:px-4 file:py-2 file:font-semibold file:text-[var(--accent)] ${
            compact ? "px-3 py-5" : "px-4 py-8"
          }`}
          required
        />
      </label>
      {progress ? (
        <p className="text-sm text-[var(--muted)]">{progress}</p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Converting…" : "Convert to PDF"}
      </button>
    </form>
  );
}
