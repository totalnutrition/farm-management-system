"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PathHome } from "@/lib/misc";
import { createClient } from "@/lib/supabase-server";

export type LoginState = {
  error?: string;
};

export async function login( _prevState: LoginState, formData: FormData, ): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(PathHome);
}
