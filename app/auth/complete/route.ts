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
  const configuredOrigin = new URL(process.env.APP_URL ?? request.url).origin;
  const submittedOrigin = request.headers.get("origin");
  const forwardedHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))
    ?.split(",")[0]
    .trim();
  let responseOrigin = configuredOrigin;
  if (submittedOrigin) {
    try {
      const parsedOrigin = new URL(submittedOrigin);
      if (process.env.NODE_ENV !== "production" || !forwardedHost || parsedOrigin.host === forwardedHost) {
        responseOrigin = parsedOrigin.origin;
      }
    } catch {
      // Use the configured origin when an invalid Origin header is supplied.
    }
  }
  const code = formData.get("code");
  const tokenHash = formData.get("token_hash");
  const rawType = formData.get("type");
  const type = typeof rawType === "string" && allowedOtpTypes.has(rawType as EmailOtpType)
    ? rawType as EmailOtpType
    : null;

  if (typeof code !== "string" && (typeof tokenHash !== "string" || !type)) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_link", responseOrigin), 303);
  }

  const fallback = type === "invite" || type === "recovery" || typeof code === "string" ? "/set-password" : "/";
  const next = safeNextPath(formData.get("next"), fallback);
  const supabase = await createServerSupabaseClient();
  const { error } = typeof code === "string"
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash as string, type: type! });

  if (error) {
    console.error("Auth email confirmation failed", error.message);
    return NextResponse.redirect(new URL("/sign-in?error=invalid_link", responseOrigin), 303);
  }

  return NextResponse.redirect(new URL(next, responseOrigin), 303);
}
