import Link from "next/link";
import Container from "@/components/Container";

export default function HomePage() {
  return (
    <Container>
      <section className="wb-card p-8">
        <p className="text-sm text-[var(--wb-muted)]">wildlife-blogger</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
          Research. Write. Publish.
          <span className="block text-[var(--wb-accent2)]">For wildlife conservation.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--wb-muted)]">
          Bring together competitor research, your organization’s knowledge base, and SEO-aware writing
          to publish content that search engines and LLMs can confidently cite.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="wb-button inline-flex items-center gap-2" href="/dashboard">
            Open dashboard
          </Link>
          <Link className="wb-button inline-flex items-center gap-2" href="/blog">
            View public blog
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="wb-card p-5">
            <div className="text-sm font-semibold">Knowledge base</div>
            <div className="mt-2 text-sm text-[var(--wb-muted)]">
              Upload docs, paste notes, or fetch URLs. Build context your AI can write with.
            </div>
          </div>
          <div className="wb-card p-5">
            <div className="text-sm font-semibold">Competitor research</div>
            <div className="mt-2 text-sm text-[var(--wb-muted)]">
              Analyze other organizations’ pages to understand headings, topics, and keyword signals.
            </div>
          </div>
          <div className="wb-card p-5">
            <div className="text-sm font-semibold">Publish & SEO</div>
            <div className="mt-2 text-sm text-[var(--wb-muted)]">
              Draft, edit, and publish to a fast blog with metadata, structured data, and feeds.
            </div>
          </div>
        </div>
      </section>
    </Container>
  );
}

