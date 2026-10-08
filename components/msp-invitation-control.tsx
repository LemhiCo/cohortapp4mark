"use client";

import { useActionState, useState } from "react";

import {
  generateMspSetupLink,
  sendMspSetupLink,
  type CopySetupLinkState,
  type InviteActionState,
} from "@/app/admin/actions";

const initialState: InviteActionState = { status: "idle", message: "" };
const initialCopyState: CopySetupLinkState = { status: "idle", message: "" };

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
  const [copyResult, copyAction, copyPending] = useActionState(generateMspSetupLink, initialCopyState);
  const [copyStatus, setCopyStatus] = useState("");
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
      <div className="flex flex-wrap gap-2">
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

        <form
          action={copyAction}
          onSubmit={(event) => {
            setCopyStatus("");
            if (!window.confirm(`Generate a fresh 72-hour setup link for ${contactEmail}? Any older copied setup link will stop working.`)) {
              event.preventDefault();
            }
          }}
        >
          <input name="mspId" type="hidden" value={mspId} />
          <button
            className="min-h-10 rounded-md border border-evergreen bg-white px-4 text-sm font-semibold text-evergreen transition hover:bg-sage disabled:cursor-not-allowed disabled:border-[#B8B3A9] disabled:text-[#8A887F]"
            disabled={!canSend || copyPending}
            type="submit"
          >
            {copyPending ? "Generating…" : "Generate copyable link"}
          </button>
        </form>
      </div>

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

      {copyResult.message ? (
        <div
          className={`mt-3 rounded-md px-3 py-3 text-sm ${copyResult.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}
          role="status"
        >
          <p>{copyResult.message}</p>
          {copyResult.setupUrl ? (
            <div className="mt-3">
              <label className="font-semibold" htmlFor={`setup-link-${mspId}`}>Secure setup link</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-sm text-forest-ink"
                  id={`setup-link-${mspId}`}
                  onFocus={(event) => event.currentTarget.select()}
                  readOnly
                  type="url"
                  value={copyResult.setupUrl}
                />
                <button
                  className="min-h-10 rounded-md bg-evergreen px-4 font-semibold text-white hover:bg-dark-evergreen"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(copyResult.setupUrl ?? "");
                      setCopyStatus("Copied to clipboard.");
                    } catch {
                      setCopyStatus("Copy failed. Select the link and copy it manually.");
                    }
                  }}
                  type="button"
                >
                  Copy link
                </button>
              </div>
              <p className="mt-2 text-xs leading-5">
                Valid for 72 hours. Opening or scanning it does not use it up; it closes only after password setup succeeds.
              </p>
              {copyStatus ? <p className="mt-2 font-semibold" aria-live="polite">{copyStatus}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
