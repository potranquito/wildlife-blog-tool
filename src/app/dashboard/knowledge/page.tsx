import KnowledgeBaseClient from "@/app/dashboard/knowledge/KnowledgeBaseClient";
import { listSources } from "@/lib/storage/sources";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  const sources = await listSources();
  return <KnowledgeBaseClient initialSources={sources} />;
}

