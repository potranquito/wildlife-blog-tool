import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function isAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return Boolean(token && isValidSessionToken(token));
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/login");
}
