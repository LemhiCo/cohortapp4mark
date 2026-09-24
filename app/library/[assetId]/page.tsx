import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireMspProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const profile = await requireMspProfile();
  const supabase = await createServerSupabaseClient();
  const [{ data: msp }, { data: asset }] = await Promise.all([
    supabase.from("msps").select("name").eq("id", profile.msp_id).single(),
    supabase
      .from("assets")
      .select("id, title, category, kind, mime_type, storage_path, external_url, summary, action_items")
      .eq("id", assetId)
      .eq("status", "ready")
      .maybeSingle(),
  ]);

  if (!asset) notFound();

  let signedUrl: string | null = null;
  if (asset.kind === "file" && asset.storage_path) {
    const { data } = await supabase.storage.from("portal-assets").createSignedUrl(asset.storage_path, 300);
    signedUrl = data?.signedUrl ?? null;
  }

  const actionItems = Array.isArray(asset.action_items)
    ? asset.action_items.filter((item): item is string => typeof item === "string")
    : [];

  return (
    <AppShell activeNav="library" eyebrow={msp?.name ?? "Your MSP"} profile={profile} title={asset.title}>
      <div className="-mt-5 mb-8 flex flex-wrap items-center gap-3 text-sm">
        <Link className="font-semibold text-evergreen hover:underline" href="/library">← Library</Link>
        <span className="text-line">·</span>
        <span className="capitalize text-muted">{asset.category.replace("_", " ")}</span>
      </div>

      {asset.kind === "link" && asset.external_url ? (
        <section className="rounded-xl border border-line bg-paper p-8 text-center">
          <p className="text-base text-muted">This resource opens on another site.</p>
          <a className="mt-5 inline-flex min-h-11 items-center rounded-md bg-evergreen px-5 font-semibold text-white hover:bg-dark-evergreen" href={asset.external_url} target="_blank" rel="noreferrer">Open resource ↗</a>
        </section>
      ) : signedUrl ? (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <section className="overflow-hidden rounded-xl border border-line bg-paper">
            {asset.mime_type === "application/pdf" ? (
              <iframe className="h-[72vh] min-h-[560px] w-full" src={signedUrl} title={asset.title} />
            ) : asset.mime_type?.startsWith("video/") ? (
              <video className="aspect-video w-full bg-black" controls preload="metadata" src={signedUrl}>
                Your browser does not support video playback.
              </video>
            ) : (
              <div className="grid min-h-80 place-items-center p-8 text-center">
                <div>
                  <p className="text-base text-muted">Preview is not available for this file type.</p>
                  <a className="mt-5 inline-flex min-h-11 items-center rounded-md bg-evergreen px-5 font-semibold text-white" href={`/api/assets/${asset.id}?download=1`}>Download file</a>
                </div>
              </div>
            )}
          </section>
          <aside className="space-y-6">
            <section className="rounded-xl border border-line bg-paper p-6">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">About this item</p>
              <p className="mt-4 text-base leading-7 text-muted">{asset.summary || "No summary has been added yet."}</p>
              <a className="mt-6 inline-flex min-h-11 items-center rounded-md border border-line px-4 font-semibold text-evergreen hover:border-evergreen" href={`/api/assets/${asset.id}?download=1`}>Download</a>
            </section>
            {actionItems.length ? (
              <section className="rounded-xl border border-line bg-paper p-6">
                <h2 className="font-serif text-2xl font-bold text-dark-evergreen">Action items</h2>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
                  {actionItems.map((item) => <li className="border-l-2 border-accent-orange pl-3" key={item}>{item}</li>)}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      ) : (
        <section className="rounded-xl border border-line bg-paper p-8 text-center">
          <h2 className="font-serif text-2xl font-bold text-dark-evergreen">File temporarily unavailable</h2>
          <p className="mt-2 text-base text-muted">Please return to the library and try again.</p>
        </section>
      )}
    </AppShell>
  );
}
