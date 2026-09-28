import { ChecklistView } from "@/components/msp-views/checklist-view";
import { requireAdminProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "View as MSP · Checklist" };

export default async function PreviewChecklistPage({ params }: { params: Promise<{ mspId: string }> }) {
  const { mspId } = await params;
  const profile = await requireAdminProfile();
  return <ChecklistView mspId={mspId} preview profile={profile} />;
}
