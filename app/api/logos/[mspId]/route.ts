import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ mspId: z.uuid() });

export async function GET(_request: Request, { params }: { params: Promise<{ mspId: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createServerSupabaseClient();
  let logoPath: string | null = null;

  if (profile.role === "lemhi_admin" || profile.msp_id === parsed.data.mspId) {
    const { data: msp } = await supabase.from("msps").select("logo_path").eq("id", parsed.data.mspId).maybeSingle();
    logoPath = msp?.logo_path ?? null;
  } else {
    const { data: peer } = await supabase.from("cohort_peers").select("logo_path").eq("id", parsed.data.mspId).maybeSingle();
    logoPath = peer?.logo_path ?? null;
  }

  if (!logoPath) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await supabase.storage.from("msp-logos").createSignedUrl(logoPath, 300);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
