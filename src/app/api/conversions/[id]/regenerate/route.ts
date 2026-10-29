import { NextResponse } from "next/server";
import { regeneratePdf } from "@/lib/conversion/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const conversion = await regeneratePdf(id);
    return NextResponse.json({ conversion });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Regenerate failed" },
      { status: 500 },
    );
  }
}
