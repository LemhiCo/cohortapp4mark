import { MagicLinkForm } from "./magic-link-form";

export const metadata = { title: "Sign in" };

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;
  const demoMode = process.env.DEMO_LOGIN_ENABLED !== "false";

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden bg-dark-evergreen px-6 py-8 text-white sm:px-10 lg:min-h-screen lg:px-16 lg:py-12">
        <div
          aria-hidden="true"
          className="absolute -right-28 top-24 size-72 rounded-full border border-white/10 sm:size-96 lg:-right-20 lg:top-36"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-24 size-80 rounded-full border border-white/10"
        />

        <div className="relative flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" aria-hidden="true" className="size-6" src="/logo-mark-white.png" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-[0.22em]">Lemhi</span>
        </div>

        <div className="relative max-w-2xl py-12 lg:py-20">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-[#E7A16D]">
            Cohort Portal
          </p>
          <h1 className="max-w-xl font-serif text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl lg:text-7xl">
            Everything for your cohort, in one place.
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-white/72 sm:text-lg">
            Follow the weekly plan, join sessions, and find every document and recording your team needs.
          </p>
        </div>

        <p className="relative text-sm text-white/55">Built for Lemhi partners</p>
      </section>

      <section className="flex items-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-orange">Welcome back</p>
          <h2 className="mt-4 font-serif text-4xl font-bold leading-tight text-dark-evergreen sm:text-5xl">
            Sign in to your cohort
          </h2>
          <p className="mt-4 text-base leading-7 text-muted">
            {demoMode
              ? "For this team preview, enter any @lemhi.com email address. No email or password is required."
              : "Use the email address where you received your Lemhi invitation. No password required."}
          </p>

          {error ? (
            <p className="mt-5 rounded-md bg-[#F7E4D6] px-4 py-3 text-sm leading-6 text-[#6B3216]" role="alert">
              {error === "inactive"
                ? "This portal access is inactive. Contact your Lemhi lead for help."
                : "That sign-in link is invalid or expired. Request a new link below."}
            </p>
          ) : null}

          <MagicLinkForm demoMode={demoMode} />

          <div className="mt-8 border-t border-line pt-6">
            <p className="text-sm leading-6 text-muted">
              {demoMode
                ? "Demo access opens a shared workspace with sample data and no admin permissions."
                : "The link expires for your protection. If it does, return here to request a new one."}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
