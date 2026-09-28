import { CohortView } from "@/components/msp-views/cohort-view";
import { requireMspProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cohort" };

export default async function CohortPage() {
  const profile = await requireMspProfile();
  return <CohortView mspId={profile.msp_id} preview={false} profile={profile} />;
}
