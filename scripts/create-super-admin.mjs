// One-time bootstrap: create the first super admin.
// Usage: npm run bootstrap:super-admin -- <email> <password> "<full name>"

import { createClient } from "@supabase/supabase-js";

const [, , email, password, ...nameParts] = process.argv;
const fullName = nameParts.join(" ").trim();

if (!email || !password || !fullName) {
  console.error(
    'Usage: npm run bootstrap:super-admin -- <email> <password> "<full name>"',
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Reuse existing auth user if email already taken; otherwise create.
let userId;
{
  const { data: list, error } = await admin.auth.admin.listUsers();
  if (error) {
    console.error("listUsers failed:", error.message);
    process.exit(1);
  }
  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) {
    userId = existing.id;
    console.log(`Found existing auth user ${email} (${userId}).`);
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: "super_admin" },
    });
    if (updErr) {
      console.error("updateUserById failed:", updErr.message);
      process.exit(1);
    }
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { role: "super_admin" },
      });
    if (createErr || !created.user) {
      console.error("createUser failed:", createErr?.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`Created auth user ${email} (${userId}).`);
  }
}

// 2. Upsert profile row.
const { error: profErr } = await admin.from("profiles").upsert(
  {
    id: userId,
    email,
    full_name: fullName,
    role: "super_admin",
    organization_id: null,
    is_active: true,
  },
  { onConflict: "id" },
);
if (profErr) {
  console.error("profiles upsert failed:", profErr.message);
  process.exit(1);
}

console.log("\nSuper admin bootstrapped successfully.");
console.log(`Email: ${email}`);
console.log("Sign in at /login. (Log out / in if you were already signed in,");
console.log("so the new app_metadata role enters your JWT.)");
