"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { PathLogin } from "@/lib/misc";

export async function logout() {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect(PathLogin);
}
