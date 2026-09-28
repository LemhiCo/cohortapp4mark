import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { LibraryBrowser } from "@/components/library-browser";
import { MspPreviewBar } from "@/components/msp-views/preview-bar";
import type { CurrentProfile } from "@/lib/auth";
import { isUuid, visibleAssetsFilter } from "@/lib/msp-visibility";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LibraryViewProps = {
  mspId: string;
  /** An admin's read-only "View as MSP" preview rather than the MSP's own page. */
  preview: boolean;
  profile: CurrentProfile;
};

export async function LibraryView({ mspId, preview, profile }: LibraryViewProps) {
  if (!isUuid(mspId)) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: msp } = await supabase.from("msps").select("id, name, cohort_id").eq("id", mspId).maybeSingle();
  if (!msp) notFound();

  const { data: assets } = await supabase
    .from("assets")
    .select("id, title, category, kind, mime_type, scope, external_url, created_at")
    .eq("status", "ready")
    .or(visibleAssetsFilter(msp.cohort_id, msp.id))
    .order("created_at", { ascending: false });

  return (
    <AppShell activeNav={preview ? "cohorts" : "library"} eyebrow={msp.name} profile={profile} title="Library">
      {preview ? <MspPreviewBar active="library" mspId={msp.id} mspName={msp.name} /> : null}
      <div className={`${preview ? "" : "-mt-5 "}mb-8 max-w-3xl text-base leading-7 text-muted`}>
        Starter documents and everything shared with your cohort or team.
      </div>
      <LibraryBrowser
        assets={(assets ?? []).map((asset) => ({
          category: asset.category,
          createdAt: asset.created_at,
          externalUrl: asset.external_url,
          id: asset.id,
          kind: asset.kind,
          mimeType: asset.mime_type,
          scope: asset.scope,
          title: asset.title,
        }))}
        openMode={preview ? "direct" : "portal"}
      />
    </AppShell>
  );
}
