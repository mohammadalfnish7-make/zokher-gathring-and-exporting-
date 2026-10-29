import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createConversionFromUpload } from "@/lib/conversion/service";

export const runtime = "nodejs";

export async function GET() {
  const conversions = await prisma.conversion.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      agentRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return NextResponse.json({ conversions });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Only .xlsx / .xls Excel files are supported" },
        { status: 400 },
      );
    }
    const { id } = await createConversionFromUpload(file);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
