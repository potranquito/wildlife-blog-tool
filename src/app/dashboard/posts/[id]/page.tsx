import { notFound } from "next/navigation";
import PostEditorClient from "@/app/dashboard/posts/[id]/PostEditorClient";
import { getPostById } from "@/lib/storage/posts";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) return notFound();
  return <PostEditorClient initial={post} />;
}

