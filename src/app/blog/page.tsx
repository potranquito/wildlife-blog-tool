import Link from "next/link";
import Container from "@/components/Container";
import { listPublishedPosts } from "@/lib/storage/posts";

export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const posts = await listPublishedPosts();

  return (
    <Container>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="mt-2 text-[var(--wb-muted)]">
          Research-backed wildlife conservation writing from wildlife-blogger.
        </p>
      </header>

      <div className="grid gap-4">
        {posts.length === 0 ? (
          <div className="wb-card p-6 text-[var(--wb-muted)]">No posts published yet.</div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="wb-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  <Link className="wb-link" href={`/blog/${post.slug}`}>
                    {post.title}
                  </Link>
                </h2>
                <div className="text-xs text-[var(--wb-muted)]">
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}
                </div>
              </div>
              <p className="mt-3 text-[var(--wb-muted)]">{post.summary}</p>
              {post.keywords.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.keywords.slice(0, 8).map((k) => (
                    <span
                      key={k}
                      className="rounded-full border border-[var(--wb-border)] bg-black/20 px-3 py-1 text-xs text-[var(--wb-muted)]"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </Container>
  );
}

