import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/site";
import { listPublishedPosts } from "@/lib/storage/posts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const posts = await listPublishedPosts();

  return [
    { url: `${baseUrl}/`, lastModified: new Date() },
    { url: `${baseUrl}/blog`, lastModified: new Date() },
    ...posts.map((p) => ({
      url: `${baseUrl}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt)
    }))
  ];
}

