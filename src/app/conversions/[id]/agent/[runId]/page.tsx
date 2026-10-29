import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string; runId: string }> };

export default async function AgentRunPage({ params }: Props) {
  const { id, runId } = await params;
  const run = await prisma.agentRun.findFirst({
    where: { id: runId, conversionId: id },
    include: {
      conversion: true,
      messages: { orderBy: { sequence: "asc" } },
    },
  });
  if (!run) notFound();

  const errors = JSON.parse(run.errorsJson) as unknown[];
  const fixSteps = JSON.parse(run.fixStepsJson) as string[];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/conversions/${id}`}
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Back to {run.conversion.drCode}
        </Link>
        <h1 className="mt-2 text-4xl font-semibold">Agent transcript</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Full request/response history for this verification run
        </p>
      </div>

      <div className="panel flex flex-wrap items-center gap-3 p-5 text-sm">
        <StatusBadge
          status={run.passed ? "verified" : "needs_fix"}
        />
        <span>Confidence {run.confidence}%</span>
        <span>Model: {run.model}</span>
        <span>{new Date(run.createdAt).toLocaleString()}</span>
      </div>

      <section className="panel space-y-3 p-6">
        <h2 className="text-xl font-semibold">Summary</h2>
        <p className="text-sm text-[var(--muted)]">{run.summary}</p>
        {fixSteps.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Fix steps</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
              {fixSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {Array.isArray(errors) && errors.length > 0 ? (
          <pre className="overflow-auto rounded-xl bg-[#0f172a] p-4 text-xs text-slate-100">
            {JSON.stringify(errors, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Messages</h2>
        {run.messages.map((message) => (
          <article key={message.id} className="panel p-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <span>
                #{message.sequence} · {message.role}
              </span>
              <span>{new Date(message.createdAt).toLocaleString()}</span>
            </div>
            <pre className="whitespace-pre-wrap break-words text-sm text-[var(--ink)]">
              {message.content}
            </pre>
            {message.rawJson ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-[var(--accent)]">
                  Raw payload
                </summary>
                <pre className="mt-2 overflow-auto rounded-xl bg-[#0f172a] p-4 text-xs text-slate-100">
                  {JSON.stringify(JSON.parse(message.rawJson), null, 2)}
                </pre>
              </details>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
