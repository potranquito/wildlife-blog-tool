import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api";
import { createSourceFromText } from "@/lib/storage/sources";

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
  }

  const name = file.name || "upload";
  const isText = file.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(name);
  if (!isText) {
    return NextResponse.json({ error: "Unsupported file type. Use .txt or .md." }, { status: 400 });
  }

  const contentText = Buffer.from(await file.arrayBuffer()).toString("utf8");
  const source = await createSourceFromText({
    type: "UPLOAD",
    title: name,
    contentText
  });

  return NextResponse.json({ source });
}

