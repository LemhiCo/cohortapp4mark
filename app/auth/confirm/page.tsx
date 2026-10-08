import { AuthConfirmClient } from "./auth-confirm-client";

export const metadata = { title: "Confirming access" };

const allowedOtpTypes = new Set(["email", "email_change", "invite", "magiclink", "recovery", "signup"]);

type AuthConfirmPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthConfirmPage({ searchParams }: AuthConfirmPageProps) {
  const params = await searchParams;
  const code = first(params.code);
  const tokenHash = first(params.token_hash);
  const type = first(params.type);
  const next = first(params.next);

  if (code) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-xl border border-line bg-paper p-8 text-center shadow-[0_18px_50px_rgba(18,19,15,0.06)]">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-orange">Lemhi portal</p>
          <h1 className="mt-4 font-serif text-3xl font-bold text-dark-evergreen">Reset your password</h1>
          <p className="mt-4 text-sm leading-6 text-muted">
            Continue to choose a secure password for your Lemhi account.
          </p>
          <form action="/auth/complete" method="post" className="mt-7">
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="next" value={next ?? "/set-password"} />
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center rounded-md bg-evergreen px-5 text-base font-semibold text-white transition hover:bg-dark-evergreen"
            >
              Continue securely
            </button>
          </form>
          <p className="mt-5 text-xs leading-5 text-muted">Opening this page does not use up the secure code.</p>
        </section>
      </main>
    );
  }

  if (!tokenHash || !type || !allowedOtpTypes.has(type)) {
    // Keep compatibility with confirmation links issued before the hosted email
    // templates switched to the token-hash flow.
    return <AuthConfirmClient />;
  }

  const isRecovery = type === "recovery";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-md rounded-xl border border-line bg-paper p-8 text-center shadow-[0_18px_50px_rgba(18,19,15,0.06)]">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-orange">Lemhi portal</p>
        <h1 className="mt-4 font-serif text-3xl font-bold text-dark-evergreen">
          {isRecovery ? "Reset your password" : "Open your workspace"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          {isRecovery
            ? "Continue to choose a new password for your Lemhi account."
            : "Continue to finish setting up your secure Lemhi workspace."}
        </p>
        <form action="/auth/complete" method="post" className="mt-7">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next ?? (isRecovery || type === "invite" ? "/set-password" : "/")} />
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center rounded-md bg-evergreen px-5 text-base font-semibold text-white transition hover:bg-dark-evergreen"
          >
            Continue securely
          </button>
        </form>
        <p className="mt-5 text-xs leading-5 text-muted">This secure link can be used only once.</p>
      </section>
    </main>
  );
}
