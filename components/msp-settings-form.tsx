"use client";

import { useActionState } from "react";

import { updateMspSettings, type AdminMspActionState } from "@/app/admin/msps/actions";

const initialState: AdminMspActionState = { status: "idle", message: "" };
const fieldClass = "min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm shadow-sm focus:border-evergreen focus:outline-none";

type MspSettingsFormProps = {
  mspId: string;
  name: string;
  status: "active" | "deactivated";
  website: string;
};

export function MspSettingsForm({ mspId, name, status, website }: MspSettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateMspSettings, initialState);

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input name="mspId" type="hidden" value={mspId} />
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>Company name</span>
        <input className={fieldClass} defaultValue={name} name="name" required />
      </label>
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>Website</span>
        <input className={fieldClass} defaultValue={website} name="website" placeholder="https://company.com" type="url" />
      </label>
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>Access</span>
        <select className={fieldClass} defaultValue={status} name="status">
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </label>
      <button className="min-h-11 rounded-md bg-evergreen px-4 text-sm font-semibold text-white hover:bg-dark-evergreen disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save settings"}
      </button>
      {state.message ? (
        <p className={`rounded-md px-3 py-2 text-sm ${state.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
