import "server-only";

import { redirect } from "next/navigation";

import type { Tables } from "@/lib/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CurrentProfile = Tables<"profiles">;
export type CurrentMspProfile = CurrentProfile & {
  msp_id: string;
  role: "msp_owner" | "msp_member";
};

export function homeForRole(role: CurrentProfile["role"]) {
  return role === "lemhi_admin" ? "/admin" : "/cohort";
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.active) return null;

  if (profile.role !== "lemhi_admin") {
    if (!profile.msp_id) return null;

    const { data: msp } = await supabase
      .from("msps")
      .select("id")
      .eq("id", profile.msp_id)
      .eq("status", "active")
      .maybeSingle();

    if (!msp) return null;
  }

  return profile;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");
  return profile;
}

export async function requireAdminProfile() {
  const profile = await requireProfile();
  if (profile.role !== "lemhi_admin") redirect(homeForRole(profile.role));
  return profile;
}

export async function requireMspProfile(): Promise<CurrentMspProfile> {
  const profile = await requireProfile();
  if (profile.role === "lemhi_admin" || !profile.msp_id) redirect(homeForRole(profile.role));
  return profile as CurrentMspProfile;
}
