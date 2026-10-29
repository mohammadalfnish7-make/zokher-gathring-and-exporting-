import { notFound } from "next/navigation";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { serializeConversion } from "@/lib/conversion/serialize";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ ids?: string }> };

export default async function WorkspacePage({ searchParams }: Props) {
  const { ids: idsParam } = await searchParams;
  const ids = (idsParam || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) notFound();

  const conversions = await prisma.conversion.findMany({
    where: { id: { in: ids } },
    include: {
      edits: { orderBy: { createdAt: "desc" } },
      agentRuns: { orderBy: { createdAt: "desc" } },
    },
  });

  // Keep tab order matching upload order
  const byId = new Map(conversions.map((c) => [c.id, c]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(serializeConversion);

  if (ordered.length === 0) notFound();

  return <WorkspaceTabs conversions={ordered} />;
}
