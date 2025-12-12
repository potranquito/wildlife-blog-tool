import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/site";
import { initStorage } from "@/lib/storage/init";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = getBaseUrl();
  const dataDir = process.env.WILDLIFE_BLOGGER_DATA_DIR?.trim() || "(default ./data)";

  const azureConfigured =
    Boolean(process.env.AZURE_OPENAI_ENDPOINT?.trim()) &&
    Boolean(process.env.AZURE_OPENAI_API_KEY?.trim()) &&
    Boolean(process.env.AZURE_OPENAI_DEPLOYMENT?.trim());

  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

  let storageOk = true;
  let storageError: string | undefined;
  try {
    await initStorage();
  } catch (e) {
    storageOk = false;
    storageError = e instanceof Error ? e.message : "Unknown storage error";
  }

  return NextResponse.json(
    {
      ok: storageOk,
      baseUrl,
      dataDir,
      ai: {
        provider: azureConfigured ? "azure-openai" : openaiConfigured ? "openai" : "template",
        azureConfigured,
        openaiConfigured
      },
      env: {
        adminPasswordSet: Boolean(process.env.WILDLIFE_BLOGGER_ADMIN_PASSWORD?.trim()),
        sessionSecretSet: Boolean(process.env.WILDLIFE_BLOGGER_SESSION_SECRET?.trim())
      },
      storage: {
        ok: storageOk,
        error: storageError
      },
      timestamp: new Date().toISOString()
    },
    { headers: { "cache-control": "no-store" } }
  );
}

