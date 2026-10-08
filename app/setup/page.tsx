import { SetupLinkClient } from "./setup-link-client";

export const metadata = { title: "Set up your portal" };

export default function SetupPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <section className="w-full max-w-lg rounded-xl border border-line bg-paper p-7 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-orange">Lemhi portal</p>
        <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-dark-evergreen">Set up your workspace</h1>
        <SetupLinkClient />
      </section>
    </main>
  );
}
