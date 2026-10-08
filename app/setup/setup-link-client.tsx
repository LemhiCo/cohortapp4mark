"use client";

import { useActionState, useSyncExternalStore } from "react";

import { redeemSetupLink, type SetupLinkState } from "./actions";

const initialState: SetupLinkState = { status: "idle", message: "" };
const subscribe = () => () => {};

export function SetupLinkClient() {
  const [state, action, pending] = useActionState(redeemSetupLink, initialState);
  const token = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
    () => "",
  );

  return (
    <>
      <p className="mt-4 text-base leading-7 text-muted">
        Continue to create your portal password. You can reopen the original setup link for 72 hours until setup is complete.
      </p>
      <form action={action} className="mt-7">
        <input name="token" type="hidden" value={token} />
        <button
          className="flex min-h-12 w-full items-center justify-center rounded-md bg-evergreen px-5 text-base font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-wait disabled:opacity-65"
          disabled={!token || pending}
          type="submit"
        >
          {pending ? "Opening securely…" : "Continue securely"}
        </button>
      </form>
      {!token ? (
        <p className="mt-5 rounded-md bg-[#F7E4D6] px-4 py-3 text-sm leading-6 text-[#6B3216]" role="alert">
          This setup link is incomplete. Ask your Lemhi contact to copy a fresh link.
        </p>
      ) : null}
      {state.message ? (
        <p className="mt-5 rounded-md bg-[#F7E4D6] px-4 py-3 text-sm leading-6 text-[#6B3216]" role="status">
          {state.message}
        </p>
      ) : null}
      <p className="mt-5 text-xs leading-5 text-muted">
        Email security scanners and simply opening this page do not use up the link.
      </p>
    </>
  );
}
