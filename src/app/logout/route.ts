import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getBaseUrl } from "@/lib/site";

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/", getBaseUrl()));
  res.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", expires: new Date(0) });
  return res;
}
