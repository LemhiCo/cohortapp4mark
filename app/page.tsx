import { redirect } from "next/navigation";

import { getCurrentProfile, homeForRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  redirect(profile ? homeForRole(profile.role) : "/sign-in");
}
