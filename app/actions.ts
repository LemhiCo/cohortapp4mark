"use server";

import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

function isDemoProfileEmail(email: string) {
  return email.startsWith("demo-") && email.endsWith("@lemhi.com");
}

/**
 * Demo-only "view as" toggle. Only reachable from a nav button that is itself
 * only rendered for a profile that already came in through the demo sign-in
 * path, and re-checks that here since this is a server action any client
 * could in principle call directly.
 */
export async function switchDemoView(target: "admin" | "client") {
  if (process.env.DEMO_LOGIN_ENABLED === "false") redirect("/sign-in");

  const profile = await getCurrentProfile();
  if (!profile || !isDemoProfileEmail(profile.email)) redirect("/sign-in");

  const demoUserEmail = target === "admin" ? "demo-admin@lemhi.com" : "demo-client@lemhi.com";
  const destination = target === "admin" ? "/admin" : "/cohort";

  const admin = createAdminSupabaseClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    email: demoUserEmail,
    options: {
      data: {
        demo_access: true,
        full_name: target === "admin" ? "Lemhi Demo Admin" : "Lemhi Demo Viewer",
      },
    },
    type: "magiclink",
  });

  if (linkError || !link.properties?.hashed_token) {
    console.error("Demo view switch failed", linkError);
    redirect(destination);
  }

  const supabase = await createServerSupabaseClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });

  if (verifyError) console.error("Demo view switch verification failed", verifyError);

  redirect(destination);
}
