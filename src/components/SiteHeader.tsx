import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--wb-border)] bg-black/20 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link className="flex items-center gap-2 font-semibold tracking-tight" href="/">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--wb-accent)]" />
          wildlife-blogger
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="text-[var(--wb-muted)] hover:text-white" href="/blog">
            Blog
          </Link>
          <Link className="text-[var(--wb-muted)] hover:text-white" href="/dashboard">
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}

