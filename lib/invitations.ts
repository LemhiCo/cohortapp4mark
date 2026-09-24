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

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, active, msp_id, role")
    .eq("email", input.email)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.active) {
      return { ok: false as const, message: "That email already has portal access." };
    }
    return { ok: false as const, message: "That account is inactive. Ask a Lemhi admin to reactivate it." };
  }

  const { data: openInvitation } = await admin
    .from("invitations")
    .select("id, expires_at")
    .eq("email", input.email)
    .eq("status", "pending")
    .maybeSingle();

  if (openInvitation) {
    return {
      ok: false as const,
      message: "An invitation is already pending. They can also request a fresh sign-in link.",
    };
  }

  const { data: invitation, error: invitationError } = await admin
    .from("invitations")
    .insert({
      email: input.email,
      invited_by: input.invitedBy,
      msp_id: input.mspId,
      role: input.role,
    })
    .select("id")
    .single();

  if (invitationError || !invitation) {
    console.error("Invitation record failed", invitationError);
    return { ok: false as const, message: "The invitation could not be created." };
  }

  const { error: authError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.fullName },
    redirectTo: input.redirectTo,
  });

  if (authError) {
    await admin
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitation.id);
    console.error("Auth invitation failed", authError);
    return { ok: false as const, message: "The invitation email could not be sent." };
  }

  return { ok: true as const, message: `Invitation sent to ${input.email}.` };
}
