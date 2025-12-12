import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Container from "@/components/Container";
import { SESSION_COOKIE_NAME, isValidSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token && isValidSessionToken(token)) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <Container>
      <div className="wb-card mx-auto max-w-md p-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin sign in</h1>
        <p className="mt-2 text-sm text-[var(--wb-muted)]">
          This dashboard is for wildlife-blogger admins only.
        </p>

        {error ? (
          <div className="mt-4 wb-card border-red-400/30 p-3 text-sm text-red-200">
            Invalid password. Try again.
          </div>
        ) : null}

        <form action="/api/auth/login" method="POST" className="mt-6 grid gap-3">
          <label className="text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input className="wb-input" id="password" name="password" type="password" autoComplete="current-password" />
          <button className="wb-button" type="submit">
            Sign in
          </button>
        </form>

        <div className="mt-6 text-xs text-[var(--wb-muted)]">
          Public blog:{" "}
          <Link className="wb-link" href="/blog">
            /blog
          </Link>
        </div>
      </div>
    </Container>
  );
}
