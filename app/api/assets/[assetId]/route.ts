import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ assetId: z.uuid() });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createServerSupabaseClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("id, kind, storage_path")
    .eq("id", parsed.data.assetId)
    .eq("status", "ready")
    .maybeSingle();

  if (!asset?.storage_path || asset.kind !== "file") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error } = await supabase.storage
    .from("portal-assets")
    .createSignedUrl(asset.storage_path, 300, download ? { download: true } : undefined);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }

  await supabase.from("activity_events").insert({
    event_type: "asset_open",
    metadata: { asset_id: asset.id, download },
    msp_id: profile.msp_id,
    user_id: profile.id,
  });

  return NextResponse.redirect(data.signedUrl);
}
