import { NextResponse } from "next/server";
import { verifyConversion } from "@/lib/agent/persist";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const { run, result } = await verifyConversion(id);
    return NextResponse.json({ run, result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verify failed" },
      { status: 500 },
    );
  }
}
