import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/components/Container";
import Markdown from "@/components/Markdown";
import { getBaseUrl } from "@/lib/site";
import { getOrgProfile } from "@/lib/storage/org";
import { getPublishedPostBySlug } from "@/lib/storage/posts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};

  const baseUrl = getBaseUrl();
  const canonical = `${baseUrl}/blog/${post.slug}`;

  const title = post.seoTitle?.trim() || post.title;
  const description = post.seoDescription?.trim() || post.summary;

  return {
    title,
    description,
    alternates: { canonical },
    keywords: post.keywords,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return notFound();

  const baseUrl = getBaseUrl();
  const org = await getOrgProfile();
  const canonical = `${baseUrl}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription ?? post.summary,
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Organization", name: org.name },
    publisher: { "@type": "Organization", name: org.name },
    keywords: post.keywords.join(", ")
  };

  return (
    <Container>
      <article className="wb-card p-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link className="wb-link text-sm" href="/blog">
            ← Back to blog
          </Link>
          <div className="text-xs text-[var(--wb-muted)]">
            {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}
          </div>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight">{post.title}</h1>
        {post.subtitle ? <p className="mt-3 text-[var(--wb-muted)]">{post.subtitle}</p> : null}

        <div className="mt-8 wb-markdown">
          <Markdown markdown={post.contentMarkdown} />
        </div>
      </article>
    </Container>
  );
}
