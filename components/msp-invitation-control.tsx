"use client";

import { useActionState } from "react";

import { sendMspSetupLink, type InviteActionState } from "@/app/admin/actions";

const initialState: InviteActionState = { status: "idle", message: "" };

type MspInvitationControlProps = {
  contactEmail: string | null;
  contactName: string | null;
  expiresAt?: string | null;
  mspId: string;
  mspName: string;
  state: "active" | "draft" | "expired" | "invited" | "ready";
};

export function MspInvitationControl({
  contactEmail,
  contactName,
  expiresAt,
  mspId,
  mspName,
  state,
}: MspInvitationControlProps) {
  const [result, action, pending] = useActionState(sendMspSetupLink, initialState);
  const canSend = Boolean(contactEmail && contactName) && state !== "active";
  const resend = state === "invited" || state === "expired";
  const expiryLabel = expiresAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(expiresAt))
    : null;

  if (state === "active") {
    return <p className="mt-3 text-sm font-semibold text-evergreen">Account setup complete</p>;
  }

  return (
    <div className="mt-4">
      <form
        action={action}
        onSubmit={(event) => {
          const actionLabel = state === "expired" ? "Send a new" : resend ? "Resend" : "Send";
          if (!window.confirm(`${actionLabel} account setup link to ${contactEmail} for ${mspName}?`)) {
            event.preventDefault();
          }
        }}
      >
        <input name="mspId" type="hidden" value={mspId} />
        <button
          className="min-h-10 rounded-md bg-evergreen px-4 text-sm font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-not-allowed disabled:bg-[#B8B3A9]"
          disabled={!canSend || pending}
          type="submit"
        >
          {pending ? "Sending…" : state === "expired" ? "Send new setup link" : resend ? "Resend setup link" : "Send setup link"}
        </button>
      </form>

      {state === "expired" ? (
        <p className="mt-2 text-sm font-semibold text-[#8A431C]">The previous setup link expired. Sending a new one will not recreate the MSP portal.</p>
      ) : state === "invited" && expiryLabel ? (
        <p className="mt-2 text-sm text-muted" suppressHydrationWarning>Current link expires {expiryLabel}. You can resend it any time.</p>
      ) : null}

      {!canSend ? (
        <p className="mt-2 text-sm text-muted">Add the main contact in the MSP dashboard before sending access.</p>
      ) : null}

      {result.message ? (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${result.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}
          role="status"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
