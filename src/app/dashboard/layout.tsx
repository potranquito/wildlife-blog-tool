import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/server";
import { getOrgProfile } from "@/lib/storage/org";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const org = await getOrgProfile();
  if (!org.onboardingCompletedAt) redirect("/onboarding");

  return (
    <div className="md:pl-[280px]">
      <aside className="wb-card fixed left-4 top-24 z-10 hidden h-fit w-[260px] p-5 md:block">
        <div className="text-xs uppercase tracking-wide text-[var(--wb-muted)]">Dashboard</div>
        <div className="mt-3 grid gap-2 text-sm">
          <Link className="wb-button text-center" href="/dashboard">
            Overview
          </Link>
          <Link className="wb-button text-center" href="/dashboard/knowledge">
            Knowledge base
          </Link>
          <Link className="wb-button text-center" href="/dashboard/research">
            Research
          </Link>
          <Link className="wb-button text-center" href="/dashboard/monitor">
            Monitor
          </Link>
          <Link className="wb-button text-center" href="/dashboard/posts">
            Posts
          </Link>
          <Link className="wb-button text-center" href="/dashboard/settings">
            Org settings
          </Link>
          <Link className="wb-button text-center" href="/logout">
            Log out
          </Link>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
