import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateConversionFields } from "@/lib/conversion/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const conversion = await prisma.conversion.findUnique({
    where: { id },
    include: {
      edits: { orderBy: { createdAt: "desc" } },
      agentRuns: {
        orderBy: { createdAt: "desc" },
        include: { messages: { orderBy: { sequence: "asc" } } },
      },
    },
  });
  if (!conversion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ conversion });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await request.json();
    const updated = await updateConversionFields(id, {
      comments: body.comments,
      palletNote: body.palletNote,
      markAliases: body.markAliases,
    });
    return NextResponse.json({ conversion: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    );
  }
}
