import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ assetId: z.uuid() });
const bodySchema = z.object({ status: z.enum(["ready", "failed"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "lemhi_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("assets")
    .update({ status: parsedBody.data.status })
    .eq("id", parsedParams.data.assetId)
    .eq("kind", "file");

  if (error) return NextResponse.json({ error: "The asset could not be updated." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
