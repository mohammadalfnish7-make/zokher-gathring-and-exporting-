import { NextResponse } from "next/server";
import { verifyConversion } from "@/lib/agent/persist";
import { regeneratePdf } from "@/lib/conversion/service";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const conversion = await regeneratePdf(id);
    const { result } = await verifyConversion(id);
    return NextResponse.json({ conversion, confidence: result.confidence });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Regenerate failed" },
      { status: 500 },
    );
  }
}
