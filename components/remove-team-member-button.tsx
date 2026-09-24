"use client";

import { useActionState } from "react";

import { removeTeamMember, type TeamActionState } from "@/app/team/actions";

const initialState: TeamActionState = { status: "idle", message: "" };

export function RemoveTeamMemberButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(removeTeamMember, initialState);

  return (
    <form action={action} className="text-right">
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 rounded-md border border-[#D5A485] px-3 text-sm font-semibold text-[#7A3B18] transition hover:bg-[#F7E4D6] disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state.status === "error" ? <p className="mt-2 text-xs text-[#7A3B18]">{state.message}</p> : null}
    </form>
  );
}
