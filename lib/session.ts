import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type SessionUser = Session["user"] & {
  role?: string | null;
  banned?: boolean | null;
};

export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = session.user as SessionUser;
  if (user.banned) redirect("/login?error=banned");
  return session;
}

export async function requireOwner(): Promise<Session> {
  const session = await requireSession();
  const user = session.user as SessionUser;
  if (user.role !== "owner") redirect("/");
  return session;
}

export function isOwner(user: { role?: string | null }): boolean {
  return user.role === "owner";
}
