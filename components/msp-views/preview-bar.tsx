import Link from "next/link";

type PreviewPage = "cohort" | "checklist" | "library" | "team";

const pages: Array<{ id: PreviewPage; label: string }> = [
  { id: "cohort", label: "Roadmap" },
  { id: "checklist", label: "Checklist" },
  { id: "library", label: "Library" },
  { id: "team", label: "Team" },
];

export function MspPreviewBar({ active, mspId, mspName }: { active: PreviewPage; mspId: string; mspName: string }) {
  return (
    <div className="-mt-5 mb-8 rounded-xl border border-evergreen/30 bg-sage/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-dark-evergreen">
          Viewing as {mspName}. Read-only: nothing here changes their portal.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="rounded-md bg-evergreen px-3 py-2 text-sm font-semibold text-white hover:bg-dark-evergreen" href={`/admin/msps/${mspId}/team`}>Manage team access</Link>
          <Link className="text-sm font-semibold text-evergreen hover:underline" href={`/admin/msps/${mspId}`}>← Back to MSP admin</Link>
        </div>
      </div>
      <nav aria-label="MSP preview" className="mt-3 flex flex-wrap gap-2">
        {pages.map((page) => (
          <Link
            aria-current={active === page.id ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${active === page.id ? "bg-dark-evergreen text-white" : "bg-white text-evergreen hover:bg-paper"}`}
            href={`/admin/msps/${mspId}/preview/${page.id}`}
            key={page.id}
          >
            {page.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
