import fs from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveDriverPdfPath } from "@/lib/conversion/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") || "pdf";

  const conversion = await prisma.conversion.findUnique({ where: { id } });
  if (!conversion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (kind === "excel") {
    const bytes = await fs.readFile(conversion.sourcePath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${conversion.sourceFilename}"`,
      },
    });
  }

  if (kind === "pdf-driver") {
    const driverPath = resolveDriverPdfPath(conversion);
    try {
      const bytes = await fs.readFile(driverPath);
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${conversion.drCode}-driver.pdf"`,
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Driver PDF not ready — regenerate PDFs first" },
        { status: 404 },
      );
    }
  }

  if (!conversion.pdfPath) {
    return NextResponse.json({ error: "PDF not ready" }, { status: 404 });
  }
  const bytes = await fs.readFile(conversion.pdfPath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${conversion.drCode}.pdf"`,
    },
  });
}
