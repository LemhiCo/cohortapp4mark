"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const allowedOtpTypes = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

export function AuthConfirmClient() {
  const [failed, setFailed] = useState(false);
  const confirmationStarted = useRef(false);

  useEffect(() => {
    // A PKCE code is single-use. React development checks may invoke effects
    // twice, so guard the exchange to prevent a successful first request from
    // racing a second request that reports the code as already consumed.
    if (confirmationStarted.current) return;
    confirmationStarted.current = true;

    async function confirm() {
      const supabase = createBrowserSupabaseClient();
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const code = search.get("code");
      const tokenHash = search.get("token_hash");
      const rawType = search.get("type") ?? hash.get("type");
      const type = rawType && allowedOtpTypes.has(rawType as EmailOtpType)
        ? rawType as EmailOtpType
        : null;

      let error: Error | null = null;
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        error = result.error;
      } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        error = result.error;
      } else if (tokenHash && type) {
        const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        error = result.error;
      } else {
        const result = await supabase.auth.getSession();
        error = result.error ?? (result.data.session ? null : new Error("No auth session"));
      }

      if (error) {
        setFailed(true);
        window.location.replace("/sign-in?error=invalid_link");
        return;
      }

      window.location.replace("/set-password");
    }

    void confirm();
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-md rounded-xl border border-line bg-paper p-8 text-center shadow-[0_18px_50px_rgba(18,19,15,0.06)]">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-orange">Lemhi portal</p>
        <h1 className="mt-4 font-serif text-3xl font-bold text-dark-evergreen">
          {failed ? "This link could not be verified" : "Opening your workspace…"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          {failed ? "Returning you to sign in." : "Please keep this tab open for a moment."}
        </p>
      </section>
    </main>
  );
}
