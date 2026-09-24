import { AppShell } from "@/components/app-shell";
import { LibraryBrowser } from "@/components/library-browser";
import { requireMspProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const profile = await requireMspProfile();
  const supabase = await createServerSupabaseClient();
  const [{ data: msp }, { data: assets }] = await Promise.all([
    supabase.from("msps").select("name").eq("id", profile.msp_id).single(),
    supabase
      .from("assets")
      .select("id, title, category, kind, mime_type, scope, external_url, created_at")
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AppShell activeNav="library" eyebrow={msp?.name ?? "Your MSP"} profile={profile} title="Library">
      <div className="-mt-5 mb-8 max-w-3xl text-base leading-7 text-muted">
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
      />
    </AppShell>
  );
}
