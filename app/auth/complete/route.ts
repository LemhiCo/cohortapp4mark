import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedOtpTypes = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function safeNextPath(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tokenHash = formData.get("token_hash");
  const rawType = formData.get("type");
  const type = typeof rawType === "string" && allowedOtpTypes.has(rawType as EmailOtpType)
    ? rawType as EmailOtpType
    : null;

  if (typeof tokenHash !== "string" || !type) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_link", request.url), 303);
  }

  const fallback = type === "invite" || type === "recovery" ? "/set-password" : "/";
  const next = safeNextPath(formData.get("next"), fallback);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    console.error("Auth email confirmation failed", error.message);
    return NextResponse.redirect(new URL("/sign-in?error=invalid_link", request.url), 303);
  }

  return NextResponse.redirect(new URL(next, request.url), 303);
}
