import PostsListClient from "@/app/dashboard/posts/PostsListClient";
import { listPosts } from "@/lib/storage/posts";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const posts = await listPosts();
  return <PostsListClient initialPosts={posts} />;
}
