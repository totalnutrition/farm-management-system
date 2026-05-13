import { redirect } from "next/navigation";
import { PathSettingsOrganization } from "@/lib/misc";

export default function OrganizationIndex() {
  redirect(`${PathSettingsOrganization}/general`);
}
