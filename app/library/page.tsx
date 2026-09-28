import { LibraryView } from "@/components/msp-views/library-view";
import { requireMspProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const profile = await requireMspProfile();
  return <LibraryView mspId={profile.msp_id} preview={false} profile={profile} />;
}
