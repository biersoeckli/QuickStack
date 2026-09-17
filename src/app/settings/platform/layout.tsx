import { getAdminUserSession } from "@/server/utils/action-wrapper.utils"

export default async function PlatformSettingsLayout({ children }: { children: React.ReactNode }) {
  await getAdminUserSession()
  return children
}
