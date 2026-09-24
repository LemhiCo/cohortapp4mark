import Link from "next/link";

import type { CurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/actions";

type AppShellProps = {
  activeNav?: "cohort" | "checklist" | "library" | "team" | "cohorts" | "admin-library";
  children: React.ReactNode;
  eyebrow: string;
  profile: CurrentProfile;
  title: string;
};

export function AppShell({ activeNav, children, eyebrow, profile, title }: AppShellProps) {
  const isAdmin = profile.role === "lemhi_admin";
  const mspNav = [
    { href: "/cohort", id: "cohort" as const, label: "Cohort" },
    { href: "/checklist", id: "checklist" as const, label: "Checklist" },
    { href: "/library", id: "library" as const, label: "Library" },
    ...(profile.role === "msp_owner" ? [{ href: "/team", id: "team" as const, label: "Team" }] : []),
  ];
  const adminNav = [
    { href: "/admin", id: "cohorts" as const, label: "Cohorts" },
    { href: "/admin/library", id: "admin-library" as const, label: "Library" },
  ];
  const navItems = isAdmin ? adminNav : mspNav;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 bg-dark-evergreen text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={isAdmin ? "/admin" : "/cohort"}
              className="grid size-10 place-items-center rounded-md border border-white/20 font-serif text-2xl font-bold"
              aria-label="Lemhi Cohort Portal home"
            >
              L
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E7A16D]">{eyebrow}</p>
              <p className="mt-1 font-serif text-xl font-bold">Lemhi Cohort Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="hidden text-right sm:block">
              <p className="font-semibold">{profile.full_name || profile.email}</p>
              <p className="text-white/60">{profile.email}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-10 rounded-md border border-white/20 px-4 font-semibold transition hover:bg-white/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        {navItems.length ? (
          <nav aria-label="Portal" className="border-t border-white/10">
            <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 sm:px-8">
              {navItems.map((item) => (
                <Link
                  aria-current={activeNav === item.id ? "page" : undefined}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                    activeNav === item.id
                      ? "border-[#E7A16D] text-white"
                      : "border-transparent text-white/65 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.id}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-orange">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-dark-evergreen sm:text-5xl">{title}</h1>
        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}
