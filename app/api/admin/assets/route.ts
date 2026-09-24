import { NextResponse } from "next/server";
import { z } from "zod";

import type { TablesInsert } from "@/lib/database.types";
import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const attachmentSchema = z.object({
  id: z.uuid(),
  type: z.enum(["program_week", "program_task", "cohort_week", "cohort_task"]),
}).nullable();

const assetSchema = z.object({
  attachment: attachmentSchema,
  category: z.enum(["recording", "transcript", "documentation", "marketing_asset", "link"]),
  externalUrl: z.url().optional(),
  fileName: z.string().trim().min(1).max(240).optional(),
  kind: z.enum(["file", "link"]),
  mimeType: z.string().trim().min(1).max(160).optional(),
  scope: z.enum(["program", "cohort", "msp"]),
  scopeId: z.uuid(),
  sizeBytes: z.number().int().min(0).max(5368709120).optional(),
  title: z.string().trim().min(2).max(200),
}).superRefine((value, context) => {
  if (value.kind === "file" && (!value.fileName || !value.mimeType || value.sizeBytes === undefined)) {
    context.addIssue({ code: "custom", message: "File details are required." });
  }
  if (value.kind === "link" && !value.externalUrl) {
    context.addIssue({ code: "custom", message: "A link URL is required." });
  }
  if (value.scope === "program" && value.attachment && !value.attachment.type.startsWith("program_")) {
    context.addIssue({ code: "custom", message: "Program assets require a program attachment." });
  }
  if (value.scope !== "program" && value.attachment?.type.startsWith("program_")) {
    context.addIssue({ code: "custom", message: "Cohort and MSP assets require a cohort attachment." });
  }
});

function safeFileName(fileName: string) {
  const normalized = fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^[-.]+|[-.]+$/g, "") || "file";
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "lemhi_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = assetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid asset." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const assetId = crypto.randomUUID();
  const input = parsed.data;
  const insert: TablesInsert<"assets"> = {
    category: input.category,
    created_by: profile.id,
    external_url: input.kind === "link" ? input.externalUrl : null,
    id: assetId,
    kind: input.kind,
    mime_type: input.kind === "file" ? input.mimeType : null,
    scope: input.scope,
    size_bytes: input.kind === "file" ? input.sizeBytes : null,
    status: input.kind === "link" ? "ready" : "pending",
    title: input.title,
  };

  if (input.scope === "program") insert.program_id = input.scopeId;
  if (input.scope === "cohort") insert.cohort_id = input.scopeId;
  if (input.scope === "msp") insert.msp_id = input.scopeId;
  if (input.attachment?.type === "program_week") insert.program_week_id = input.attachment.id;
  if (input.attachment?.type === "program_task") insert.program_task_id = input.attachment.id;
  if (input.attachment?.type === "cohort_week") insert.cohort_week_id = input.attachment.id;
  if (input.attachment?.type === "cohort_task") insert.cohort_task_id = input.attachment.id;

  if (input.kind === "file" && input.fileName) {
    insert.storage_path = `${input.scope}/${input.scopeId}/${assetId}/${safeFileName(input.fileName)}`;
  }

  const { error: insertError } = await supabase.from("assets").insert(insert);
  if (insertError) {
    console.error("Asset metadata creation failed", insertError);
    return NextResponse.json({ error: "The asset could not be created." }, { status: 400 });
  }

  if (input.kind === "link") return NextResponse.json({ assetId });
  return NextResponse.json({ assetId, path: insert.storage_path });
}
