"use server";

import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ChangePasswordState = {
  status: "idle" | "success" | "error";
  message: string;
};

const changePasswordSchema = z
  .object({
    confirmPassword: z.string(),
    currentPassword: z.string().min(1),
    newPassword: z.string().min(12).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Choose a password different from your current password.",
    path: ["newPassword"],
  });

export async function changeAdminPassword(
  _previousState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const profile = await requireAdminProfile();
  const parsed = changePasswordSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return {
      status: "error",
      message: issue === "Passwords do not match."
        || issue === "Choose a password different from your current password."
        ? issue
        : "Use at least 12 characters for your new password.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: parsed.data.currentPassword,
  });

  if (signInError) {
    return { status: "error", message: "Your current password is not correct." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (updateError) {
    console.error("Admin password change failed", updateError.message);
    return { status: "error", message: "Your password could not be changed. Try again." };
  }

  return { status: "success", message: "Password changed. Use your new password the next time you sign in." };
}
