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

if (!email || !email.endsWith("@lemhi.com")) {
  throw new Error("Usage: npm run admin:bootstrap -- name@lemhi.com [Full Name]");
}

if (!url || !secretKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
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

const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { full_name: fullName },
  redirectTo: `${appUrl}/auth/confirm`,
});

if (inviteError) throw inviteError;
console.log(`Admin invitation sent to ${email}.`);
