"use client";

import { useActionState, useId, useState } from "react";

import {
  generateAdminTeammateSetupLink,
  type CopySetupLinkState,
} from "@/app/admin/actions";

const initialState: CopySetupLinkState = { status: "idle", message: "" };

function SetupLinkResult({
  inputId,
  result,
}: {
  inputId: string;
  result: CopySetupLinkState;
}) {
  const [copyStatus, setCopyStatus] = useState("");

  if (!result.message) return null;

  return (
    <div
      className={`mt-3 rounded-md px-3 py-3 text-sm ${result.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}
      role="status"
    >
      <p>{result.message}</p>
      {result.setupUrl ? (
        <div className="mt-3">
          <label className="font-semibold" htmlFor={inputId}>Secure setup link</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-sm text-forest-ink"
              id={inputId}
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              type="url"
              value={result.setupUrl}
            />
            <button
              className="min-h-11 rounded-md bg-evergreen px-4 font-semibold text-white hover:bg-dark-evergreen"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.setupUrl ?? "");
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
            Send this only to this teammate. It remains valid for 72 hours and can be reopened until password setup is complete.
          </p>
          {copyStatus ? <p className="mt-2 font-semibold" aria-live="polite">{copyStatus}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function AdminAddTeammateForm({ mspId, mspName }: { mspId: string; mspName: string }) {
  const [result, action, pending] = useActionState(generateAdminTeammateSetupLink, initialState);
  const inputId = useId();

  return (
    <form
      action={action}
      className="mt-6 space-y-5"
      onSubmit={(event) => {
        if (!window.confirm(`Generate a private 72-hour setup link for this teammate at ${mspName}? If the email already has a pending link, the older link will stop working.`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="mspId" type="hidden" value={mspId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Name</span>
          <input
            autoComplete="name"
            className="min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none"
            name="fullName"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Work email</span>
          <input
            autoComplete="email"
            className="min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none"
            name="email"
            required
            type="email"
          />
        </label>
      </div>
      <button
        className="min-h-12 rounded-md bg-evergreen px-5 font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Generating…" : "Generate teammate link"}
      </button>
      <SetupLinkResult inputId={`${inputId}-new`} result={result} />
    </form>
  );
}

export function AdminReplacementTeammateLink({
  email,
  fullName,
  mspId,
  mspName,
}: {
  email: string;
  fullName: string;
  mspId: string;
  mspName: string;
}) {
  const [result, action, pending] = useActionState(generateAdminTeammateSetupLink, initialState);
  const inputId = useId();

  return (
    <form
      action={action}
      className="mt-3"
      onSubmit={(event) => {
        if (!window.confirm(`Generate a fresh 72-hour setup link for ${email} at ${mspName}? Their older setup link will stop working.`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="mspId" type="hidden" value={mspId} />
      <input name="fullName" type="hidden" value={fullName} />
      <input name="email" type="hidden" value={email} />
      <button
        className="min-h-11 rounded-md border border-evergreen px-4 text-sm font-semibold text-evergreen transition hover:bg-sage disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Generating…" : "Generate replacement link"}
      </button>
      <SetupLinkResult inputId={`${inputId}-replacement`} result={result} />
    </form>
  );
}
