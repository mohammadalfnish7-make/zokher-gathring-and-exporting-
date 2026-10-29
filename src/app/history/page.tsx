import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const conversions = await prisma.conversion.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      agentRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/"
            className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            ← Upload desk
          </Link>
          <h1 className="mt-2 text-4xl font-semibold">Conversion history</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Open any DR to edit, regenerate, or re-verify.
          </p>
        </div>
        <span className="text-sm text-[var(--muted)]">
          {conversions.length} record{conversions.length === 1 ? "" : "s"}
        </span>
      </section>

      <section className="panel p-6">
        {conversions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No conversions yet.{" "}
            <Link href="/" className="font-semibold text-[var(--accent)]">
              Upload an Excel file
            </Link>{" "}
            to start.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>DR</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Last confidence</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((c) => {
                  const last = c.agentRuns[0];
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={`/workspace?ids=${c.id}`}
                          className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
                        >
                          {c.drCode}
                        </Link>
                      </td>
                      <td>{c.sourceFilename}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>{last ? `${last.confidence}%` : "—"}</td>
                      <td>{new Date(c.updatedAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
