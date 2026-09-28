import { LibraryView } from "@/components/msp-views/library-view";
import { requireAdminProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "View as MSP · Library" };

export default async function PreviewLibraryPage({ params }: { params: Promise<{ mspId: string }> }) {
  const { mspId } = await params;
  const profile = await requireAdminProfile();
  return <LibraryView mspId={mspId} preview profile={profile} />;
}
