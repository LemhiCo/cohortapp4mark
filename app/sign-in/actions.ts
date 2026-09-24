"use server";

import { headers } from "next/headers";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MagicLinkState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function requestMagicLink(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Enter a valid work email address." };
  }

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
