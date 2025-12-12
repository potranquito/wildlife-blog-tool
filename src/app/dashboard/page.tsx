import Container from "@/components/Container";
import { getOrgProfile } from "@/lib/storage/org";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const org = await getOrgProfile();

  return (
    <Container>
      <div className="wb-card p-8">
        <div className="text-sm text-[var(--wb-muted)]">Signed in as admin</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{org.name}</h1>
        <p className="mt-3 max-w-2xl text-[var(--wb-muted)]">{org.tagline}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="wb-card p-5">
            <div className="text-sm font-semibold">1) Add context</div>
            <div className="mt-2 text-sm text-[var(--wb-muted)]">
              Upload docs, paste notes, or fetch URLs into your knowledge base.
            </div>
          </div>
          <div className="wb-card p-5">
            <div className="text-sm font-semibold">2) Research</div>
            <div className="mt-2 text-sm text-[var(--wb-muted)]">
              Analyze competitor pages to identify structure and keyword signals.
            </div>
          </div>
          <div className="wb-card p-5">
            <div className="text-sm font-semibold">3) Publish</div>
            <div className="mt-2 text-sm text-[var(--wb-muted)]">
              Generate a draft, edit it, then publish to the public blog.
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

