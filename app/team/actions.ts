"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireMspProfile } from "@/lib/auth";
import { createCopyablePortalSetupLink } from "@/lib/invitations";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type TeamActionState = {
  expiresAt?: string;
  status: "idle" | "success" | "error";
  message: string;
  setupUrl?: string;
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

  const requestHeaders = await headers();
  const appUrl = requestHeaders.get("origin") ?? process.env.APP_URL ?? "http://localhost:3000";

  const result = await createCopyablePortalSetupLink({
    ...parsed.data,
    appUrl,
    invitedBy: inviter.id,
    mspId: inviter.msp_id,
    role: "msp_member",
  });

  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/team");
  return {
    expiresAt: result.expiresAt,
    message: `A reusable 72-hour setup link is ready for ${parsed.data.email}.`,
    setupUrl: result.setupUrl,
    status: "success",
  };
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
