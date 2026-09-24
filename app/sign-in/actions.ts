"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MagicLinkState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function enterDemoPortal(claimedEmail: string) {
  const demoIdentity = createHash("sha256").update(claimedEmail).digest("hex").slice(0, 20);
  const demoUserEmail = `demo-${demoIdentity}@lemhi.com`;
  const admin = createAdminSupabaseClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    email: demoUserEmail,
    options: {
      data: {
        demo_access: true,
        full_name: "Lemhi Demo Viewer",
      },
    },
    type: "magiclink",
  });

  if (linkError || !link.properties?.hashed_token) {
    console.error("Demo session link failed", linkError);
    return { status: "error", message: "Demo access is not available yet. Please try again shortly." } as const;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });

  if (verifyError || !data.user) {
    console.error("Demo session verification failed", verifyError);
    return { status: "error", message: "Demo access is not available yet. Please try again shortly." } as const;
  }

  await Promise.all([
    admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id),
    admin.from("activity_events").insert({
      event_type: "sign_in",
      msp_id: "21000000-0000-4000-8000-000000000001",
      user_id: data.user.id,
    }),
  ]);

  redirect("/cohort");
}

export async function requestMagicLink(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Enter a valid work email address." };
  }

  if (process.env.DEMO_LOGIN_ENABLED !== "false") {
    if (!email.endsWith("@lemhi.com")) {
      return { status: "error", message: "Demo access currently requires an @lemhi.com email address." };
    }
    return enterDemoPortal(email);
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
