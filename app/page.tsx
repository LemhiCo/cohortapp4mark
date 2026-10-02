import { redirect } from "next/navigation";

import { getCurrentProfile, homeForRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile({ allowPasswordSetup: true });
  redirect(profile ? profile.password_setup_required ? "/set-password" : homeForRole(profile.role) : "/sign-in");
}
