"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type LibraryAsset = {
  category: "recording" | "transcript" | "documentation" | "marketing_asset" | "link";
  createdAt: string;
  id: string;
  kind: "file" | "link";
  mimeType: string | null;
  scope: "program" | "cohort" | "msp";
  title: string;
  externalUrl: string | null;
};

const filters = [
  ["all", "All"],
  ["recording", "Recordings"],
  ["transcript", "Transcripts"],
  ["documentation", "Documentation"],
  ["marketing_asset", "Marketing assets"],
  ["link", "Links"],
] as const;

const categoryLabels: Record<LibraryAsset["category"], string> = {
  documentation: "Documentation",
  link: "Link",
  marketing_asset: "Marketing asset",
  recording: "Recording",
  transcript: "Transcript",
};

function fileLabel(asset: LibraryAsset) {
  if (asset.kind === "link") return "Open link";
  if (asset.mimeType === "application/pdf") return "Preview";
  if (asset.category === "recording") return "Play";
  return "Open";
}

export function LibraryBrowser({ assets }: { assets: LibraryAsset[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("all");

  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesFilter = filter === "all" || asset.category === filter;
      const matchesQuery = !normalizedQuery || asset.title.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [assets, filter, query]);

  return (
    <div>
      <div className="rounded-xl border border-line bg-paper p-5 shadow-[0_14px_40px_rgba(18,19,15,0.05)] sm:p-6">
        <label className="block text-sm font-semibold text-dark-evergreen" htmlFor="library-search">Search the library</label>
        <input
          className="mt-2 min-h-12 w-full rounded-md border border-line bg-white px-4 text-base shadow-sm focus:border-evergreen focus:outline-none"
          id="library-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search documents, recordings, and links"
          type="search"
          value={query}
        />
        <div aria-label="Filter library" className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group">
          {filters.map(([value, label]) => (
            <button
              aria-pressed={filter === value}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${filter === value ? "bg-dark-evergreen text-white" : "border border-line bg-white text-muted hover:border-evergreen hover:text-evergreen"}`}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-sm font-semibold text-muted">{visibleAssets.length} {visibleAssets.length === 1 ? "item" : "items"}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleAssets.map((asset) => (
          <article className="flex min-h-56 flex-col rounded-xl border border-line bg-paper p-5 transition hover:-translate-y-0.5 hover:border-evergreen hover:shadow-[0_16px_35px_rgba(18,19,15,0.07)]" key={asset.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-11 place-items-center rounded-lg bg-sage font-serif text-xl font-bold text-dark-evergreen">
                {asset.category === "recording" ? "▶" : asset.kind === "link" ? "↗" : "F"}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${asset.scope === "msp" ? "bg-[#F7E4D6] text-[#6B3216]" : "bg-sage text-dark-evergreen"}`}>
                {asset.scope === "msp" ? "Your team only" : "Shared"}
              </span>
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-accent-orange">{categoryLabels[asset.category]}</p>
            <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-dark-evergreen">{asset.title}</h2>
            <p className="mt-2 text-sm text-muted">
              Added {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(asset.createdAt))}
            </p>
            <div className="mt-auto flex gap-2 pt-6">
              {asset.kind === "link" && asset.externalUrl ? (
                <a className="min-h-10 rounded-md bg-evergreen px-4 py-2 text-sm font-semibold text-white hover:bg-dark-evergreen" href={asset.externalUrl} target="_blank" rel="noreferrer">
                  {fileLabel(asset)} ↗
                </a>
              ) : (
                <>
                  <Link className="min-h-10 rounded-md bg-evergreen px-4 py-2 text-sm font-semibold text-white hover:bg-dark-evergreen" href={`/library/${asset.id}`}>
                    {fileLabel(asset)}
                  </Link>
                  <a className="min-h-10 rounded-md border border-line px-4 py-2 text-sm font-semibold text-evergreen hover:border-evergreen" href={`/api/assets/${asset.id}?download=1`}>
                    Download
                  </a>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      {!visibleAssets.length ? (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-paper px-6 py-14 text-center">
          <h2 className="font-serif text-2xl font-bold text-dark-evergreen">No matching items</h2>
          <p className="mt-2 text-base text-muted">Try another search or category.</p>
        </div>
      ) : null}
    </div>
  );
}
