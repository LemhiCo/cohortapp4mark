import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Hosted environments provide variables directly.
}

const email = process.argv[2]?.trim().toLowerCase();
const fullName = process.argv.slice(3).join(" ").trim();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const temporaryPassword = process.env.ADMIN_TEMP_PASSWORD;

if (!email || !email.endsWith("@lemhi.com")) {
  throw new Error("Usage: npm run admin:bootstrap -- name@lemhi.com [Full Name]");
}

if (!url || !secretKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

if (temporaryPassword && temporaryPassword.length < 12) {
  throw new Error("ADMIN_TEMP_PASSWORD must contain at least 12 characters.");
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: allowlistError } = await supabase
  .from("admin_allowlist")
  .upsert({ email, active: true });

if (allowlistError) throw allowlistError;

const { data: existingProfile } = await supabase
  .from("profiles")
  .select("id, active")
  .eq("email", email)
  .maybeSingle();

if (existingProfile?.active) {
  console.log(`${email} is already an active Lemhi admin.`);
  process.exit(0);
}

if (temporaryPassword) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: temporaryPassword,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) throw createError ?? new Error("Admin user creation failed.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, msp_id, active")
    .eq("id", created.user.id)
    .single();

  if (profileError || profile?.role !== "lemhi_admin" || profile.msp_id || !profile.active) {
    throw profileError ?? new Error("The admin profile was not provisioned correctly.");
  }

  console.log(`${email} is ready as a confirmed password admin.`);
  process.exit(0);
}

const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { full_name: fullName },
  redirectTo: `${appUrl}/auth/confirm`,
});

if (inviteError) throw inviteError;
console.log(`Admin invitation sent to ${email}.`);
