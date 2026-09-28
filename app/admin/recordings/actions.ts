"use server";

import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const oneOnOneSchema = z.object({
  localStartsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  mspId: z.uuid(),
  title: z.string().trim().min(2).max(200),
});

export async function createOneOnOneSession(input: z.input<typeof oneOnOneSchema>): Promise<{ sessionId?: string; error?: string }> {
  await requireAdminProfile();
  const parsed = oneOnOneSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose the MSP and the call’s date and time." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_one_on_one_session", {
    local_starts_at: `${parsed.data.localStartsAt}:00`,
    target_msp_id: parsed.data.mspId,
    target_title: parsed.data.title,
  });

  if (error || !data) {
    console.error("1:1 session creation failed", error);
    return { error: "The 1:1 session could not be created." };
  }
  return { sessionId: data };
}
