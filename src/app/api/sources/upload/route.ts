import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api";
import { createSourceFromText } from "@/lib/storage/sources";

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const name = file.name || "upload";
  const buffer = Buffer.from(await file.arrayBuffer());

  let contentText: string;

  // Check file type and extract text accordingly
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(name);
  const isDocx =
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(name);
  const isDoc = file.type === "application/msword" || /\.doc$/i.test(name);
  const isText = file.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(name);

  try {
    if (isPdf) {
      contentText = await extractTextFromPdf(buffer);
    } else if (isDocx) {
      contentText = await extractTextFromDocx(buffer);
    } else if (isDoc) {
      return NextResponse.json(
        { error: "Legacy .doc format not supported. Please convert to .docx" },
        { status: 400 }
      );
    } else if (isText) {
      contentText = buffer.toString("utf8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use .txt, .md, .pdf, or .docx" },
        { status: 400 }
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to extract text from file";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!contentText.trim()) {
    return NextResponse.json({ error: "No text content found in file" }, { status: 400 });
  }

  const source = await createSourceFromText({
    type: "UPLOAD",
    title: name,
    contentText
  });

  return NextResponse.json({ source });
}

