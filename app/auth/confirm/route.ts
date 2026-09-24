import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { homeForRole } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createServerSupabaseClient();
  let verified = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    verified = !error;
  }

  if (!verified) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_link", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/sign-in?error=invalid_link", request.url));

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, msp_id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/sign-in?error=inactive", request.url));
  }

  if (profile.msp_id) {
    const { data: msp } = await admin
      .from("msps")
      .select("status")
      .eq("id", profile.msp_id)
      .maybeSingle();
    if (msp?.status !== "active") {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/sign-in?error=inactive", request.url));
    }
  }

  await Promise.all([
    admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id),
    admin
      .from("invitations")
      .update({ accepted_at: new Date().toISOString(), status: "accepted" })
      .eq("auth_user_id", user.id)
      .eq("status", "pending"),
    admin.from("activity_events").insert({
      event_type: "sign_in",
      msp_id: profile.msp_id,
      user_id: user.id,
    }),
  ]);

  return NextResponse.redirect(new URL(homeForRole(profile.role), request.url));
}
