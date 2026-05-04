import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase-server";
import { PathHome, PathLogin } from "./misc";

export type UserRole = "super_admin" | "admin";

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function getRoleFromUser(user: User): UserRole | null {
  return (user.app_metadata?.role as UserRole | undefined) ?? null;
}

export function getOrganizationIdFromUser(user: User): string | null {
  return (user.app_metadata?.organization_id as string | undefined) ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(PathLogin);
  return user;
}

export async function requireRole(role: UserRole): Promise<User> {
  const user = await requireUser();
  if (getRoleFromUser(user) !== role) redirect(PathHome);
  return user;
}

export async function requireAnyRole(roles: UserRole[]): Promise<User> {
  const user = await requireUser();
  const role = getRoleFromUser(user);
  if (!role || !roles.includes(role)) redirect(PathHome);
  return user;
}
