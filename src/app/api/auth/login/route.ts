import { NextResponse } from "next/server";
import { createSessionToken, getAdminPassword, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  const adminPassword = getAdminPassword();
  if (!adminPassword || password !== adminPassword) {
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  }

  const token = createSessionToken();
  const res = NextResponse.redirect(new URL("/dashboard", request.url));
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return res;
}

