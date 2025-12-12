import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="grid gap-6 md:grid-cols-[260px,1fr]">
      <aside className="wb-card sticky top-24 h-fit p-5">
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
      <section className="min-w-0">{children}</section>
    </div>
  );
}
