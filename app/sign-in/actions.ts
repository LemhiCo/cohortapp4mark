"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { homeForRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MagicLinkState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function signInWithPassword(email: string, password: string): Promise<MagicLinkState> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { status: "error", message: "The email or password is not recognized." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, msp_id, active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    return { status: "error", message: "This portal access is inactive. Contact your Lemhi lead." };
  }

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

export async function requestMagicLink(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Enter a valid work email address." };
  }

  if (password) return signInWithPassword(email, password);

  try {
    const requestHeaders = await headers();
    const origin = process.env.APP_URL ?? requestHeaders.get("origin") ?? "http://localhost:3000";
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${origin}/auth/confirm`,
      },
    });

    if (error) console.error("Magic-link request rejected", error.message);

    return {
      status: "success",
      message: "If your invitation is active, a secure sign-in link is on its way.",
    };
  } catch (error) {
    console.error("Magic-link request failed", error);
    return {
      status: "error",
      message: "Sign-in is not available yet. Please try again shortly.",
    };
  }
}
