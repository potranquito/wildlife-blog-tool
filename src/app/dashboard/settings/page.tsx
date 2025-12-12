import OrgSettingsClient from "@/app/dashboard/settings/OrgSettingsClient";
import { getOrgProfile } from "@/lib/storage/org";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const org = await getOrgProfile();
  return <OrgSettingsClient initial={org} />;
}

