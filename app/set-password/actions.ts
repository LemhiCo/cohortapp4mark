"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { homeForRole } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PasswordSetupState = {
  status: "idle" | "error";
  message: string;
};

const passwordSchema = z
  .object({
    confirmPassword: z.string(),
    password: z.string().min(12).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
  });

export async function setPassword(
  _previousState: PasswordSetupState,
  formData: FormData,
): Promise<PasswordSetupState> {
  const parsed = passwordSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues.some((issue) => issue.message === "Passwords do not match.")
        ? "Passwords do not match."
        : "Use at least 12 characters for your password.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "This setup link is invalid or expired. Request a new one." };
  }

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, msp_id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    return { status: "error", message: "This portal access is inactive. Contact your Lemhi lead." };
  }

  if (profile.msp_id) {
    const { data: msp } = await admin
      .from("msps")
      .select("status")
      .eq("id", profile.msp_id)
      .maybeSingle();
    if (msp?.status !== "active") {
      await supabase.auth.signOut();
      return { status: "error", message: "This MSP portal is inactive. Contact your Lemhi lead." };
    }
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (passwordError) {
    console.error("Password setup failed", passwordError.message);
    return { status: "error", message: "Your password could not be saved. Request a fresh setup link and try again." };
  }

  const acceptedAt = new Date().toISOString();
  const [{ error: profileError }, { error: invitationError }] = await Promise.all([
    admin
      .from("profiles")
      .update({ last_seen_at: acceptedAt, password_setup_required: false })
      .eq("id", user.id),
    admin
      .from("invitations")
      .update({ accepted_at: acceptedAt, status: "accepted" })
      .eq("auth_user_id", user.id)
      .eq("status", "pending"),
  ]);

  if (profileError || invitationError) {
    console.error("Password setup finalization failed", profileError ?? invitationError);
    return { status: "error", message: "Your password was saved, but portal setup could not finish. Contact Lemhi support." };
  }

  await admin.from("activity_events").insert({
    event_type: "sign_in",
    msp_id: profile.msp_id,
    user_id: user.id,
  });

  redirect(homeForRole(profile.role));
}
