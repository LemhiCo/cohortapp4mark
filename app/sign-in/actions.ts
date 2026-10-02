"use server";

import { redirect } from "next/navigation";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { homeForRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function signInWithPassword(email: string, password: string): Promise<SignInState> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { status: "error", message: "The email or password is not recognized." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, msp_id, active, password_setup_required")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    return { status: "error", message: "This portal access is inactive. Contact your Lemhi lead." };
  }

  if (profile.password_setup_required) redirect("/set-password");

  if (profile.msp_id) {
    const { data: msp } = await supabase
      .from("msps")
      .select("status")
      .eq("id", profile.msp_id)
      .maybeSingle();

    if (msp?.status !== "active") {
      await supabase.auth.signOut();
      return { status: "error", message: "This MSP portal is inactive. Contact your Lemhi lead." };
    }
  }

  const admin = createAdminSupabaseClient();
  await Promise.all([
    admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id),
    admin
      .from("invitations")
      .update({ accepted_at: new Date().toISOString(), status: "accepted" })
      .eq("auth_user_id", data.user.id)
      .eq("status", "pending"),
    admin.from("activity_events").insert({
      event_type: "sign_in",
      msp_id: profile.msp_id,
      user_id: data.user.id,
    }),
  ]);

  redirect(homeForRole(profile.role));
}

export async function signIn(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Enter a valid work email address." };
  }

  if (!password) return { status: "error", message: "Enter your password to sign in." };
  return signInWithPassword(email, password);
}
