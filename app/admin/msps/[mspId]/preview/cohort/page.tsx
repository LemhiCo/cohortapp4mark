import { CohortView } from "@/components/msp-views/cohort-view";
import { requireAdminProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "View as MSP · Cohort" };

export default async function PreviewCohortPage({ params }: { params: Promise<{ mspId: string }> }) {
  const { mspId } = await params;
  const profile = await requireAdminProfile();
  return <CohortView mspId={mspId} preview profile={profile} />;
}
