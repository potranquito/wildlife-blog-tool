import PostComposerClient from "@/app/dashboard/posts/new/PostComposerClient";
import { listSources } from "@/lib/storage/sources";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const sources = await listSources();
  return <PostComposerClient sources={sources} />;
}

