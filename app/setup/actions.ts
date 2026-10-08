"use server";

import { redirect } from "next/navigation";

import { readCopyableSetupToken } from "@/lib/invitations";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SetupLinkState = {
  status: "idle" | "error";
  message: string;
};

function invalidLink(message = "This setup link is invalid, expired, or has been replaced. Ask your Lemhi contact for a fresh link."): SetupLinkState {
  return { status: "error", message };
}

export async function redeemSetupLink(
  _previousState: SetupLinkState,
  formData: FormData,
): Promise<SetupLinkState> {
  const rawToken = formData.get("token");
  if (typeof rawToken !== "string" || rawToken.length > 2_000) return invalidLink();
  const setupToken = readCopyableSetupToken(rawToken);
  if (!setupToken || Date.parse(setupToken.expiresAt) <= Date.now()) return invalidLink();

  const admin = createAdminSupabaseClient();
  const { data: invitation, error: invitationError } = await admin
    .from("invitations")
    .select("id, email, msp_id, role, status, expires_at, last_sent_at")
    .eq("id", setupToken.invitationId)
    .maybeSingle();

  if (invitation?.status === "accepted") {
    return invalidLink("Account setup is already complete. Sign in with the password you created.");
  }
  if (
    invitationError
    || !invitation
    || invitation.status !== "pending"
    || Date.parse(invitation.last_sent_at) !== Date.parse(setupToken.issuedAt)
    || Date.parse(invitation.expires_at) !== Date.parse(setupToken.expiresAt)
    || Date.parse(invitation.expires_at) <= Date.now()
  ) return invalidLink();

  const [{ data: msp }, { data: profile }] = await Promise.all([
    admin
      .from("msps")
      .select("id, status, primary_contact_name, primary_contact_email")
      .eq("id", invitation.msp_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, active, msp_id, role, password_setup_required")
      .eq("email", invitation.email)
      .maybeSingle(),
  ]);

  if (!msp || msp.status !== "active") return invalidLink();
  if (profile && (!profile.active || profile.msp_id !== invitation.msp_id || profile.role !== invitation.role)) {
    return invalidLink();
  }
  if (profile && !profile.password_setup_required) {
    return invalidLink("Account setup is already complete. Sign in with the password you created.");
  }

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const generated = profile
    ? await admin.auth.admin.generateLink({
      email: invitation.email,
      options: { redirectTo: `${appUrl}/set-password` },
      type: "recovery",
    })
    : await admin.auth.admin.generateLink({
      email: invitation.email,
      options: {
        data: { full_name: msp.primary_contact_name ?? "" },
        redirectTo: `${appUrl}/set-password`,
      },
      type: "invite",
    });

  if (generated.error || !generated.data.properties?.hashed_token) {
    console.error("Reusable setup link could not create an auth handoff", generated.error);
    return invalidLink("Your secure session could not be opened. Try this same setup link again in a moment.");
  }

  const supabase = await createServerSupabaseClient();
  const authType = profile ? "recovery" as const : "invite" as const;
  const { error: verificationError } = await supabase.auth.verifyOtp({
    token_hash: generated.data.properties.hashed_token,
    type: authType,
  });
  if (verificationError) {
    console.error("Reusable setup link auth handoff failed", verificationError.message);
    return invalidLink("Your secure session could not be opened. Try this same setup link again in a moment.");
  }

  redirect("/set-password");
}
