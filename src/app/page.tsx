import Link from "next/link";
import { UploadForm } from "@/components/UploadForm";

export default function HomePage() {
  return (
    <div className="desk-page flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-hidden">
      <section className="shrink-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            DR conversion desk
          </p>
          <Link
            href="/history"
            className="text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            History →
          </Link>
        </div>
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-[var(--ink)] sm:text-4xl">
          Excel packing lists to verified Russian pivot PDFs
        </h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Upload one or many DR Excel files. Each file opens as a tab with the
          same pivot, comments, and verify tools. Past work is on History.
        </p>
      </section>

      <div className="grid min-h-0 shrink-0 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <UploadForm compact />
        <aside className="panel space-y-2 p-4">
          <h2 className="text-base font-semibold">How verification works</h2>
          <ol className="space-y-2 text-sm text-[var(--muted)]">
            <li>1. Pivot Excel by Mark → Shop with carton/weight totals.</li>
            <li>2. Render a sample-matching Russian PDF layout.</li>
            <li>
              3. LangGraph + Anthropic compares Excel and PDF; 100% confidence
              required to mark verified.
            </li>
            <li>
              4. Below 100%: exact mismatches and step-by-step fixes for the
              operator.
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
