"use client";

import { useActionState, useState } from "react";

import { deleteAsset, updateAsset, type AssetActionState } from "@/app/admin/library/actions";

const initialState: AssetActionState = { status: "idle", message: "" };
const fieldClass = "min-h-10 w-full rounded-md border border-line bg-white px-3 text-sm shadow-sm focus:border-evergreen focus:outline-none";
const quietButton = "min-h-9 rounded-md border border-line px-3 text-sm font-semibold text-evergreen hover:border-evergreen disabled:opacity-60";

const categories = [
  { label: "Documentation", value: "documentation" },
  { label: "Marketing asset", value: "marketing_asset" },
  { label: "Transcript", value: "transcript" },
  { label: "Recording", value: "recording" },
  { label: "Link", value: "link" },
] as const;

type AssetAdminRowProps = {
  assetId: string;
  category: string;
  kind: string;
  openHref: string | null;
  scopeLabel: string;
  status: string;
  title: string;
};

export function AssetAdminRow({ assetId, category, kind, openHref, scopeLabel, status, title }: AssetAdminRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saveState, saveAction, saving] = useActionState(async (previous: AssetActionState, formData: FormData) => {
    const result = await updateAsset(previous, formData);
    if (result.status === "success") setEditing(false);
    return result;
  }, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteAsset, initialState);

  const categoryLabel = categories.find((option) => option.value === category)?.label ?? category;

  return (
    <div className="py-4 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-dark-evergreen">{title}</h3>
          <p className="mt-1 text-sm text-muted">{categoryLabel} · {kind === "link" ? "Link" : "File"} · {scopeLabel}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${status === "ready" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}>{status}</span>
      </div>

      {editing ? (
        <form action={saveAction} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <input name="assetId" type="hidden" value={assetId} />
          <label className="space-y-1 text-sm font-semibold text-dark-evergreen">
            <span>Title</span>
            <input className={fieldClass} defaultValue={title} maxLength={200} minLength={2} name="title" required />
          </label>
          <label className="space-y-1 text-sm font-semibold text-dark-evergreen">
            <span>Category</span>
            <select className={fieldClass} defaultValue={category} name="category">
              {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button className="min-h-9 rounded-md bg-evergreen px-4 text-sm font-semibold text-white hover:bg-dark-evergreen disabled:opacity-60" disabled={saving} type="submit">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button className={quietButton} disabled={saving} onClick={() => setEditing(false)} type="button">Cancel</button>
          </div>
        </form>
      ) : confirmingDelete ? (
        <form action={deleteAction} className="mt-4 rounded-md bg-[#F7E4D6] px-4 py-3">
          <input name="assetId" type="hidden" value={assetId} />
          <p className="text-sm font-semibold text-[#6B3216]">Delete “{title}”? MSPs lose access immediately, and this can’t be undone.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="min-h-9 rounded-md bg-[#6B3216] px-4 text-sm font-semibold text-white hover:bg-[#4f240f] disabled:opacity-60" disabled={deleting} type="submit">
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
            <button className={quietButton} disabled={deleting} onClick={() => setConfirmingDelete(false)} type="button">Keep it</button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {openHref ? (
            <a className={quietButton + " inline-flex items-center"} href={openHref} rel="noreferrer" target="_blank">Open ↗</a>
          ) : null}
          <button className={quietButton} onClick={() => setEditing(true)} type="button">Edit</button>
          <button className={quietButton} onClick={() => setConfirmingDelete(true)} type="button">Delete</button>
        </div>
      )}

      {[saveState, deleteState].map((state, index) => state.status === "error" ? (
        <p className="mt-2 text-sm font-semibold text-[#6B3216]" key={index} role="alert">{state.message}</p>
      ) : null)}
    </div>
  );
}
