"use client";

import { useActionState, useEffect, useRef } from "react";

import { createMspPortal, type AdminActionState } from "@/app/admin/actions";

const initialState: AdminActionState = { status: "idle", message: "" };
const fieldClass =
  "min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none";

export function MspPortalForm({ cohortId }: { cohortId: string }) {
  const [state, action, pending] = useActionState(createMspPortal, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form action={action} className="space-y-5" ref={formRef}>
      <input type="hidden" name="cohortId" value={cohortId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>MSP name</span>
          <input className={fieldClass} name="mspName" required placeholder="Northstar Technology" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Website <span className="font-normal text-muted">(optional)</span></span>
          <input className={fieldClass} name="website" type="url" placeholder="https://northstar.example" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Main contact</span>
          <input className={fieldClass} name="contactName" required autoComplete="name" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Work email</span>
          <input className={fieldClass} name="contactEmail" type="email" required autoComplete="email" />
        </label>
      </div>

      <button
        className="min-h-12 rounded-md bg-evergreen px-5 font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Creating portal…" : "Create portal & send invite"}
      </button>

      {state.message ? (
        <p
          role="status"
          className={`rounded-md px-4 py-3 text-sm ${state.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
