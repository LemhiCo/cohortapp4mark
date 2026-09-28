import { ChecklistView } from "@/components/msp-views/checklist-view";
import { requireMspProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checklist" };

export default async function ChecklistPage() {
  const profile = await requireMspProfile();
  return <ChecklistView mspId={profile.msp_id} preview={false} profile={profile} />;
}
