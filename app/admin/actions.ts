"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth";
import { createCopyablePortalSetupLink, sendPortalInvitation } from "@/lib/invitations";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type InviteActionState = AdminActionState;

export type CopySetupLinkState = AdminActionState & {
  expiresAt?: string;
  setupUrl?: string;
};

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional(),
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.email().transform((value) => value.trim().toLowerCase()).optional(),
);

const optionalName = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(2).max(120).optional(),
);

const createCohortSchema = z.object({
  leadId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  sessionTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sessionWeekday: z.coerce.number().int().min(0).max(6),
  startDate: z.iso.date(),
  timezone: z.string().trim().min(1).max(80),
});

const createMspPortalSchema = z
  .object({
    cohortId: z.uuid(),
    contactEmail: optionalEmail,
    contactName: optionalName,
    mspName: z.string().trim().min(2).max(120),
    website: optionalUrl,
  })
  .refine((value) => Boolean(value.contactEmail) === Boolean(value.contactName), {
    message: "Provide both a contact name and email, or leave both blank.",
  });

const createIndependentMspSchema = z
  .object({
    contactEmail: optionalEmail,
    contactName: optionalName,
    leadId: z.uuid(),
    mspName: z.string().trim().min(2).max(120),
    startDate: z.iso.date(),
    timezone: z.string().trim().min(1).max(80),
    website: optionalUrl,
  })
  .refine((value) => Boolean(value.contactEmail) === Boolean(value.contactName), {
    message: "Provide both a contact name and email, or leave both blank.",
  });

const updateSessionSchema = z.object({
  cohortId: z.uuid(),
  joinUrl: optionalUrl,
  localStartsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  sessionId: z.uuid(),
  title: z.string().trim().min(2).max(160),
});

const updateCohortLeadSchema = z.object({
  cohortId: z.uuid(),
  leadId: z.uuid(),
});

const inviteOwnerSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  fullName: z.string().trim().min(2).max(120),
  mspId: z.uuid(),
});

export async function createCohort(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminProfile();
  const parsed = createCohortSchema.safeParse({
    leadId: formData.get("leadId"),
    name: formData.get("name"),
    sessionTime: formData.get("sessionTime"),
    sessionWeekday: formData.get("sessionWeekday"),
    startDate: formData.get("startDate"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Complete every cohort field with a valid value." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("active", true)
    .maybeSingle();

  if (!program) return { status: "error", message: "No active program template is available." };

  const { data: lead } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.leadId)
    .eq("role", "lemhi_admin")
    .eq("active", true)
    .maybeSingle();

  if (!lead) return { status: "error", message: "Choose an active Lemhi lead." };

  const { data: cohort, error } = await supabase
    .from("cohorts")
    .insert({
      lead_id: parsed.data.leadId,
      name: parsed.data.name,
      program_id: program.id,
      session_time: parsed.data.sessionTime,
      session_weekday: parsed.data.sessionWeekday,
      start_date: parsed.data.startDate,
      timezone: parsed.data.timezone,
    })
    .select("id")
    .single();

  if (error || !cohort) {
    console.error("Cohort creation failed", error);
    return {
      status: "error",
      message: error?.code === "23505" ? "A cohort with that name already exists." : "The cohort could not be created.",
    };
  }

  revalidatePath("/admin");
  redirect(`/admin/cohorts/${cohort.id}`);
}

export async function createMspPortal(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminProfile();
  const parsed = createMspPortalSchema.safeParse({
    cohortId: formData.get("cohortId"),
    contactEmail: formData.get("contactEmail"),
    contactName: formData.get("contactName"),
    mspName: formData.get("mspName"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter an MSP name and optional full website URL. Include both contact fields or leave both blank.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id")
    .eq("id", parsed.data.cohortId)
    .maybeSingle();

  if (!cohort) return { status: "error", message: "That cohort is not available." };

  const { data: msp, error: mspError } = await supabase
    .from("msps")
    .insert({
      cohort_id: cohort.id,
      name: parsed.data.mspName,
      primary_contact_email: parsed.data.contactEmail ?? null,
      primary_contact_name: parsed.data.contactName ?? null,
      website: parsed.data.website ?? null,
    })
    .select("id")
    .single();

  if (mspError || !msp) {
    console.error("MSP portal creation failed", mspError);
    return {
      status: "error",
      message: mspError?.code === "23505" ? "That MSP already has a portal in this cohort." : "The MSP portal could not be created.",
    };
  }

  revalidatePath(`/admin/cohorts/${cohort.id}`);
  revalidatePath("/admin");
  return {
    status: "success",
    message: parsed.data.contactEmail
      ? `${parsed.data.mspName} is ready. Review the roster, then send its setup link when you choose.`
      : `${parsed.data.mspName} was added as a draft. Add its main contact before sending access.`,
  };
}

export async function createIndependentMsp(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminProfile();
  const parsed = createIndependentMspSchema.safeParse({
    contactEmail: formData.get("contactEmail"),
    contactName: formData.get("contactName"),
    leadId: formData.get("leadId"),
    mspName: formData.get("mspName"),
    startDate: formData.get("startDate"),
    timezone: formData.get("timezone"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter the MSP, start date, lead, and optional full website URL. Include both contact fields or leave both blank.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: workspaceRows, error } = await supabase.rpc("create_individual_workspace", {
    target_lead_id: parsed.data.leadId,
    target_msp_name: parsed.data.mspName,
    target_start_date: parsed.data.startDate,
    target_timezone: parsed.data.timezone,
    target_website: parsed.data.website ?? "",
  });
  const workspace = workspaceRows?.[0];

  if (error || !workspace) {
    console.error("Independent workspace creation failed", error);
    return {
      status: "error",
      message: error?.code === "23505"
        ? "An individual workspace for that MSP already exists."
        : "The independent MSP workspace could not be created.",
    };
  }

  if (parsed.data.contactEmail && parsed.data.contactName) {
    const { error: contactError } = await supabase
      .from("msps")
      .update({
        primary_contact_email: parsed.data.contactEmail,
        primary_contact_name: parsed.data.contactName,
      })
      .eq("id", workspace.msp_id);

    if (contactError) {
      console.error("Independent workspace contact update failed", contactError);
      revalidatePath("/admin");
      return {
        status: "error",
        message: `${parsed.data.mspName} was created, but its main contact could not be saved. Open the workspace to finish setup.`,
      };
    }
  }

  revalidatePath("/admin");
  return {
    status: "success",
    message: parsed.data.contactEmail
      ? `${parsed.data.mspName} now has an independent workspace. Send its setup link when the workspace is ready.`
      : `${parsed.data.mspName} now has a draft independent workspace. Add its main contact before sending access.`,
  };
}

const sendMspSetupLinkSchema = z.object({ mspId: z.uuid() });

export async function sendMspSetupLink(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const inviter = await requireAdminProfile();
  const parsed = sendMspSetupLinkSchema.safeParse({ mspId: formData.get("mspId") });
  if (!parsed.success) return { status: "error", message: "That MSP portal could not be found." };

  const admin = createAdminSupabaseClient();
  const { data: msp } = await admin
    .from("msps")
    .select("id, cohort_id, name, primary_contact_email, primary_contact_name, status")
    .eq("id", parsed.data.mspId)
    .maybeSingle();

  if (!msp || msp.status !== "active") {
    return { status: "error", message: "That MSP portal is not active." };
  }
  if (!msp.primary_contact_email || !msp.primary_contact_name) {
    return { status: "error", message: "Add the main contact’s name and email before sending access." };
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? process.env.APP_URL ?? "http://localhost:3000";

  const result = await sendPortalInvitation({
    email: msp.primary_contact_email,
    fullName: msp.primary_contact_name,
    invitedBy: inviter.id,
    mspId: msp.id,
    redirectTo: `${origin}/auth/confirm`,
    role: "msp_owner",
  });

  revalidatePath(`/admin/cohorts/${msp.cohort_id}`);
  revalidatePath(`/admin/msps/${msp.id}`);
  revalidatePath("/admin");
  return { status: result.ok ? "success" : "error", message: result.message };
}

export async function generateMspSetupLink(
  _previousState: CopySetupLinkState,
  formData: FormData,
): Promise<CopySetupLinkState> {
  const inviter = await requireAdminProfile();
  const parsed = sendMspSetupLinkSchema.safeParse({ mspId: formData.get("mspId") });
  if (!parsed.success) return { status: "error", message: "That MSP portal could not be found." };

  const admin = createAdminSupabaseClient();
  const { data: msp } = await admin
    .from("msps")
    .select("id, cohort_id, name, primary_contact_email, primary_contact_name, status")
    .eq("id", parsed.data.mspId)
    .maybeSingle();

  if (!msp || msp.status !== "active") {
    return { status: "error", message: "That MSP portal is not active." };
  }
  if (!msp.primary_contact_email || !msp.primary_contact_name) {
    return { status: "error", message: "Add the main contact’s name and email before creating access." };
  }

  const requestHeaders = await headers();
  const appUrl = process.env.APP_URL ?? requestHeaders.get("origin") ?? "http://localhost:3000";
  const result = await createCopyablePortalSetupLink({
    appUrl,
    email: msp.primary_contact_email,
    fullName: msp.primary_contact_name,
    invitedBy: inviter.id,
    mspId: msp.id,
    role: "msp_owner",
  });

  revalidatePath(`/admin/cohorts/${msp.cohort_id}`);
  revalidatePath(`/admin/msps/${msp.id}`);
  if (!result.ok) return { status: "error", message: result.message };

  return {
    expiresAt: result.expiresAt,
    message: `A reusable 72-hour setup link is ready for ${msp.primary_contact_email}.`,
    setupUrl: result.setupUrl,
    status: "success",
  };
}

export async function updateGroupSession(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminProfile();
  const parsed = updateSessionSchema.safeParse({
    cohortId: formData.get("cohortId"),
    joinUrl: formData.get("joinUrl"),
    localStartsAt: formData.get("localStartsAt"),
    sessionId: formData.get("sessionId"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Enter a title, local date and time, and optional full meeting URL." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", parsed.data.sessionId)
    .eq("cohort_id", parsed.data.cohortId)
    .eq("kind", "group")
    .maybeSingle();

  if (!session) return { status: "error", message: "That cohort session is not available." };

  const { error } = await supabase.rpc("update_group_session_local", {
    local_starts_at: parsed.data.localStartsAt.replace("T", " "),
    target_join_url: parsed.data.joinUrl ?? "",
    target_session_id: session.id,
    target_title: parsed.data.title,
  });

  if (error) {
    console.error("Session update failed", error);
    return { status: "error", message: "The session could not be updated." };
  }

  revalidatePath(`/admin/cohorts/${parsed.data.cohortId}`);
  return { status: "success", message: "Session updated." };
}

export async function updateCohortLead(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminProfile();
  const parsed = updateCohortLeadSchema.safeParse({
    cohortId: formData.get("cohortId"),
    leadId: formData.get("leadId"),
  });

  if (!parsed.success) return { status: "error", message: "Choose a Lemhi lead." };

  const supabase = await createServerSupabaseClient();
  const { data: lead } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", parsed.data.leadId)
    .eq("role", "lemhi_admin")
    .eq("active", true)
    .maybeSingle();

  if (!lead) return { status: "error", message: "Choose an active Lemhi lead." };

  const { data: cohort, error } = await supabase
    .from("cohorts")
    .update({ lead_id: parsed.data.leadId })
    .eq("id", parsed.data.cohortId)
    .select("id")
    .maybeSingle();

  if (error || !cohort) {
    console.error("Cohort lead update failed", error);
    return { status: "error", message: "The cohort lead could not be updated." };
  }

  revalidatePath(`/admin/cohorts/${parsed.data.cohortId}`);
  revalidatePath("/admin");
  return { status: "success", message: `${lead.full_name || lead.email} now leads this cohort. MSPs see them on their Cohort page.` };
}

export async function inviteMspOwner(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const inviter = await requireAdminProfile();
  const parsed = inviteOwnerSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    mspId: formData.get("mspId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Enter a name, valid email, and MSP portal." };
  }

  const admin = createAdminSupabaseClient();
  const { data: msp } = await admin
    .from("msps")
    .select("id")
    .eq("id", parsed.data.mspId)
    .eq("status", "active")
    .maybeSingle();

  if (!msp) return { status: "error", message: "That MSP portal is not active." };

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? process.env.APP_URL ?? "http://localhost:3000";

  const result = await sendPortalInvitation({
    ...parsed.data,
    invitedBy: inviter.id,
    redirectTo: `${origin}/auth/confirm`,
    role: "msp_owner",
  });

  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/admin");
  return { status: "success", message: result.message };
}
