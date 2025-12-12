export default function SiteFooter() {
  return (
    <footer className="border-t border-[var(--wb-border)] bg-black/10">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 text-sm text-[var(--wb-muted)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} wildlife-blogger</div>
          <div>Built for wildlife conservation organizations.</div>
        </div>
      </div>
    </footer>
  );
}

