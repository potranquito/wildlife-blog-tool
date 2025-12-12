import ResearchClient from "@/app/dashboard/research/ResearchClient";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  return <ResearchClient initial={[]} />;
}

