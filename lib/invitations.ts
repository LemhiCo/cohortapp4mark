import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Enums } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type InviteRole = Extract<Enums<"app_role">, "msp_owner" | "msp_member">;

type CopyableSetupLink = {
  appUrl: string;
  email: string;
  fullName: string;
  invitedBy: string;
  mspId: string;
  role: InviteRole;
};

type CopyableSetupToken = {
  expiresAt: string;
  invitationId: string;
  issuedAt: string;
  version: 1;
};

function setupLinkSigningKey() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is required for setup links.");
  return key;
}

function signCopyableSetupToken(payload: CopyableSetupToken) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", setupLinkSigningKey())
    .update(`lemhi-portal-setup-v1.${encoded}`)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function readCopyableSetupToken(token: string): CopyableSetupToken | null {
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return null;

  const expectedSignature = createHmac("sha256", setupLinkSigningKey())
    .update(`lemhi-portal-setup-v1.${encoded}`)
    .digest();
  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return null;
  }
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<CopyableSetupToken>;
    if (
      payload.version !== 1
      || typeof payload.invitationId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.invitationId)
      || typeof payload.issuedAt !== "string"
      || typeof payload.expiresAt !== "string"
      || !Number.isFinite(Date.parse(payload.issuedAt))
      || !Number.isFinite(Date.parse(payload.expiresAt))
    ) {
      return null;
    }
    return payload as CopyableSetupToken;
  } catch {
    return null;
  }
}

export function invitationHasExpired(expiresAt: string) {
  return Date.parse(expiresAt) <= Date.now();
}

export async function createCopyablePortalSetupLink(input: CopyableSetupLink) {
  const admin = createAdminSupabaseClient();
  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  const email = input.email.trim().toLowerCase();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, active, msp_id, role, password_setup_required")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    if (!existingProfile.active) {
      return { ok: false as const, message: "That account is inactive. Reactivate it before creating access." };
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
    .select("id, msp_id, role")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (openInvitation && (openInvitation.msp_id !== input.mspId || openInvitation.role !== input.role)) {
    return { ok: false as const, message: "That email already has a pending invitation to another portal." };
  }

  let invitationId = openInvitation?.id;
  if (invitationId) {
    const { error } = await admin
      .from("invitations")
      .update({
        auth_user_id: existingProfile?.id ?? null,
        expires_at: expiresAt,
        full_name: input.fullName,
        invited_by: input.invitedBy,
        last_sent_at: issuedAt,
      })
      .eq("id", invitationId);
    if (error) {
      console.error("Copyable invitation update failed", error);
      return { ok: false as const, message: "The setup link could not be prepared." };
    }
  } else {
    const { data, error } = await admin
      .from("invitations")
      .insert({
        auth_user_id: existingProfile?.id ?? null,
        email,
        expires_at: expiresAt,
        full_name: input.fullName,
        invited_by: input.invitedBy,
        last_sent_at: issuedAt,
        msp_id: input.mspId,
        role: input.role,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("Copyable invitation creation failed", error);
      return { ok: false as const, message: "The setup link could not be prepared." };
    }
    invitationId = data.id;
  }

  const rawToken = signCopyableSetupToken({ expiresAt, invitationId, issuedAt, version: 1 });
  const appUrl = input.appUrl.replace(/\/$/, "");
  return {
    ok: true as const,
    expiresAt,
    invitationId,
    setupUrl: `${appUrl}/setup#token=${rawToken}`,
  };
}
