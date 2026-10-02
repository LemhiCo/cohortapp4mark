import "server-only";

import type { Enums } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type InviteRole = Extract<Enums<"app_role">, "msp_owner" | "msp_member">;

type PortalInvitation = {
  email: string;
  fullName: string;
  invitedBy: string;
  mspId: string;
  redirectTo: string;
  role: InviteRole;
};

export async function sendPortalInvitation(input: PortalInvitation) {
  const admin = createAdminSupabaseClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, active, msp_id, role, password_setup_required")
    .eq("email", input.email)
    .maybeSingle();

  if (existingProfile) {
    if (!existingProfile.active) {
      return { ok: false as const, message: "That account is inactive. Ask a Lemhi admin to reactivate it." };
    }
    if (existingProfile.msp_id !== input.mspId || existingProfile.role !== input.role) {
      return { ok: false as const, message: "That email is already assigned to another portal." };
    }
    if (!existingProfile.password_setup_required) {
      return { ok: false as const, message: "That contact already has active portal access." };
    }
  }

  const { data: openInvitation } = await admin
    .from("invitations")
    .select("id, auth_user_id, last_sent_at")
    .eq("email", input.email)
    .eq("status", "pending")
    .maybeSingle();

  if (openInvitation?.last_sent_at) {
    const secondsSinceLastSend = (now.getTime() - new Date(openInvitation.last_sent_at).getTime()) / 1000;
    if (secondsSinceLastSend < 60) {
      return {
        ok: false as const,
        message: "A setup link was sent less than a minute ago. Wait before sending another.",
      };
    }
  }

  let invitation = openInvitation;
  let createdInvitation = false;

  if (!invitation) {
    const { data, error } = await admin
      .from("invitations")
      .insert({
        auth_user_id: existingProfile?.id ?? null,
        email: input.email,
        expires_at: expiresAt,
        invited_by: input.invitedBy,
        last_sent_at: now.toISOString(),
        msp_id: input.mspId,
        role: input.role,
      })
      .select("id, auth_user_id, last_sent_at")
      .single();

    if (error || !data) {
      console.error("Invitation record failed", error);
      return { ok: false as const, message: "The invitation could not be created." };
    }

    invitation = data;
    createdInvitation = true;
  }

  const redirectTo = `${input.redirectTo}${input.redirectTo.includes("?") ? "&" : "?"}next=/set-password`;
  const { error: authError } = existingProfile
    ? await admin.auth.resetPasswordForEmail(input.email, { redirectTo })
    : await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.fullName },
      redirectTo,
    });

  if (authError) {
    if (createdInvitation) {
      await admin
        .from("invitations")
        .update({ status: "revoked" })
        .eq("id", invitation.id);
    }
    console.error("Auth invitation failed", authError);
    return {
      ok: false as const,
      message: "The account setup email could not be sent.",
    };
  }

  const invitationUpdate = existingProfile
    ? { auth_user_id: existingProfile.id, expires_at: expiresAt, last_sent_at: now.toISOString() }
    : { expires_at: expiresAt, last_sent_at: now.toISOString() };

  await admin
    .from("invitations")
    .update(invitationUpdate)
    .eq("id", invitation.id);

  return { ok: true as const, message: `Account setup link sent to ${input.email}.` };
}
