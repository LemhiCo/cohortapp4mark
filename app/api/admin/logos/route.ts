import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] as const;
const createSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.enum(allowedMimeTypes),
  mspId: z.uuid(),
  sizeBytes: z.number().int().positive().max(10485760),
});
const completeSchema = z.object({ mspId: z.uuid(), path: z.string().trim().min(1).max(500) });

function safeFileName(fileName: string) {
  return fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "logo";
}

async function getAdmin() {
  const profile = await getCurrentProfile();
  return profile?.role === "lemhi_admin" ? profile : null;
}

export async function POST(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a PNG, JPG, WebP, or SVG logo under 10 MB." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: msp } = await supabase.from("msps").select("id").eq("id", parsed.data.mspId).maybeSingle();
  if (!msp) return NextResponse.json({ error: "MSP not found." }, { status: 404 });

  const path = `${msp.id}/${crypto.randomUUID()}-${safeFileName(parsed.data.fileName)}`;
  const { data, error } = await supabase.storage.from("msp-logos").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "The logo upload could not be started." }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}

export async function PATCH(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = completeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.path.startsWith(`${parsed.data.mspId}/`)) {
    return NextResponse.json({ error: "Invalid logo." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("msps").update({ logo_path: parsed.data.path }).eq("id", parsed.data.mspId);
  if (error) return NextResponse.json({ error: "The logo could not be saved." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
