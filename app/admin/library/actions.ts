"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AssetActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const assetIdSchema = z.object({ assetId: z.uuid() });
const updateSchema = assetIdSchema.extend({
  category: z.enum(["recording", "transcript", "documentation", "marketing_asset", "link"]),
  title: z.string().trim().min(2).max(200),
});

function revalidateLibraryViews() {
  revalidatePath("/admin/library");
  revalidatePath("/admin/msps/[mspId]", "page");
  revalidatePath("/library");
  revalidatePath("/checklist");
}

export async function updateAsset(
  _previousState: AssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  await requireAdminProfile();
  const parsed = updateSchema.safeParse({
    assetId: formData.get("assetId"),
    category: formData.get("category"),
    title: formData.get("title"),
  });

  if (!parsed.success) return { status: "error", message: "Enter a title of at least 2 characters." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ category: parsed.data.category, title: parsed.data.title })
    .eq("id", parsed.data.assetId)
    .select("id");

  if (error || !data?.length) {
    console.error("Asset update failed", error);
    return { status: "error", message: "The asset could not be saved." };
  }

  revalidateLibraryViews();
  return { status: "success", message: "Saved." };
}

export async function deleteAsset(
  _previousState: AssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  await requireAdminProfile();
  const parsed = assetIdSchema.safeParse({ assetId: formData.get("assetId") });
  if (!parsed.success) return { status: "error", message: "That asset could not be found." };

  const supabase = await createServerSupabaseClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("id, storage_path")
    .eq("id", parsed.data.assetId)
    .maybeSingle();

  if (!asset) return { status: "error", message: "That asset could not be found." };

  // The file must go first: storage read access is granted through the asset
  // row, so once the row is deleted nobody (admins included) can reach the
  // object to remove it.
  if (asset.storage_path) {
    const { error: storageError } = await supabase.storage.from("portal-assets").remove([asset.storage_path]);
    if (storageError) {
      console.error("Asset file removal failed", asset.storage_path, storageError);
      return { status: "error", message: "The stored file could not be removed. Try again." };
    }
  }

  const { data: deleted, error } = await supabase.from("assets").delete().eq("id", asset.id).select("id");
  if (error || !deleted?.length) {
    console.error("Asset delete failed", error);
    await supabase.from("assets").update({ status: "failed" }).eq("id", asset.id);
    return { status: "error", message: "The file was removed but the entry could not be deleted. It is now hidden from MSPs." };
  }

  revalidateLibraryViews();
  return { status: "success", message: "Deleted." };
}
