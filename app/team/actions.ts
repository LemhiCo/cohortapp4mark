"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMspProfile } from "@/lib/auth";
import { sendPortalInvitation } from "@/lib/invitations";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type TeamActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const inviteMemberSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  fullName: z.string().trim().min(2).max(120),
});

export async function inviteTeamMember(
  _previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const inviter = await requireMspProfile();
  if (inviter.role !== "msp_owner" || !inviter.msp_id) {
    return { status: "error", message: "Only your MSP’s main contact can invite teammates." };
  }

  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) return { status: "error", message: "Enter a name and valid work email." };

  const result = await sendPortalInvitation({
    ...parsed.data,
    invitedBy: inviter.id,
    mspId: inviter.msp_id,
    redirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/auth/confirm`,
    role: "msp_member",
  });

  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/team");
  return { status: "success", message: result.message };
}

const removeMemberSchema = z.object({ userId: z.uuid() });

export async function removeTeamMember(
  _previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const owner = await requireMspProfile();
  if (owner.role !== "msp_owner" || !owner.msp_id) {
    return { status: "error", message: "Only your MSP’s main contact can remove teammates." };
  }

  const parsed = removeMemberSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success || parsed.data.userId === owner.id) {
    return { status: "error", message: "That team member cannot be removed." };
  }

  const admin = createAdminSupabaseClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", parsed.data.userId)
    .eq("msp_id", owner.msp_id)
    .eq("role", "msp_member")
    .eq("active", true)
    .maybeSingle();

  if (!target) return { status: "error", message: "That active teammate was not found." };

  const { error: profileError } = await admin
    .from("profiles")
    .update({ active: false })
    .eq("id", target.id);

  if (profileError) return { status: "error", message: "The teammate could not be removed." };

  const { error: authError } = await admin.auth.admin.updateUserById(target.id, {
    ban_duration: "876000h",
  });

  if (authError) {
    await admin.from("profiles").update({ active: true }).eq("id", target.id);
    console.error("Team member ban failed", authError);
    return { status: "error", message: "The teammate could not be removed." };
  }

  await admin
    .from("invitations")
    .update({ status: "revoked" })
    .eq("auth_user_id", target.id)
    .eq("status", "pending");

  revalidatePath("/team");
  return { status: "success", message: "Teammate removed." };
}
