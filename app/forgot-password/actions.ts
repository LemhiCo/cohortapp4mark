"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  status: "idle" | "success" | "error";
  message: string;
};

const emailSchema = z.email().transform((value) => value.trim().toLowerCase());

export async function requestPasswordReset(
  _previousState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "Enter a valid work email address." };

  try {
    const requestHeaders = await headers();
    const origin = requestHeaders.get("origin") ?? process.env.APP_URL ?? "http://localhost:3000";
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${origin}/auth/confirm?next=/set-password`,
    });
    if (error) console.error("Password reset request rejected", error.message);
  } catch (error) {
    console.error("Password reset request failed", error);
  }

  return {
    status: "success",
    message: "If an active account exists for that email, a password-reset link is on its way.",
  };
}
