import fs from "fs/promises";
import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { resolveDriverPdfPath } from "@/lib/conversion/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") || "pdfs";

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

  if (kind === "pdf") {
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

  // Default: both PDFs in one zip
  if (!conversion.pdfPath) {
    return NextResponse.json({ error: "PDF not ready" }, { status: 404 });
  }
  const driverPath = resolveDriverPdfPath(conversion);
  let officeBytes: Buffer;
  let driverBytes: Buffer;
  try {
    [officeBytes, driverBytes] = await Promise.all([
      fs.readFile(conversion.pdfPath),
      fs.readFile(driverPath),
    ]);
  } catch {
    return NextResponse.json(
      { error: "PDFs not ready — regenerate PDFs first" },
      { status: 404 },
    );
  }

  const zip = new JSZip();
  zip.file(`${conversion.drCode}.pdf`, officeBytes);
  zip.file(`${conversion.drCode}-driver.pdf`, driverBytes);
  const zipBytes = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(zipBytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${conversion.drCode}-pdfs.zip"`,
    },
  });
}
