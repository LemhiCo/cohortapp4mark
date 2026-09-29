import { MagicLinkForm } from "./magic-link-form";

export const metadata = { title: "Sign in" };

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Lemhi" className="h-10 w-auto sm:h-12" src="/logo-mark-white.png" />
          <span className="font-serif text-2xl font-bold sm:text-3xl">Lemhi</span>
        </div>

        <div className="relative max-w-2xl py-12 lg:py-20">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-[#E7A16D]">
            MSP Growth Portal
          </p>
          <h1 className="max-w-xl font-serif text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl lg:text-7xl">
            Your path from strategy to launch, in one place.
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-white/72 sm:text-lg">
            Follow your roadmap, complete each requirement, and find every resource your team needs—whether you are in a cohort or working directly with Lemhi.
          </p>
        </div>

        <p className="relative text-sm text-white/55">Built for Lemhi partners</p>
      </section>

      <section className="flex items-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-orange">Welcome back</p>
          <h2 className="mt-4 font-serif text-4xl font-bold leading-tight text-dark-evergreen sm:text-5xl">
            Sign in to your workspace
          </h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Sign in with your Lemhi portal password, or leave the password blank to receive a secure email link.
          </p>

          {error ? (
            <p className="mt-5 rounded-md bg-[#F7E4D6] px-4 py-3 text-sm leading-6 text-[#6B3216]" role="alert">
              {error === "inactive"
                ? "This portal access is inactive. Contact your Lemhi lead for help."
                : "That sign-in link is invalid or expired. Request a new link below."}
            </p>
          ) : null}

          <MagicLinkForm />

          <div className="mt-8 border-t border-line pt-6">
            <p className="text-sm leading-6 text-muted">
              Email links expire for your protection. If a link expires, return here to request another.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
