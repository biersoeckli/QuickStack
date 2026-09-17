import {
  Box,
  Boxes,
  ChevronsLeftRightEllipsis,
  Hammer,
  HardDrive,
  KeyRound,
  Network,
  ShieldCheck,
  Rocket,
  User,
  User2,
  Wrench,
  type LucideIcon,
} from "lucide-react"

export type SettingsNavigationItem = {
  title: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}

export type SettingsNavigationGroup = {
  title: string
  items: SettingsNavigationItem[]
}

export const settingsNavigation: SettingsNavigationGroup[] = [
  {
    title: "Account & Access",
    items: [
      { title: "Profile & Security", href: "/settings/account/profile", icon: User },
      { title: "API Keys", href: "/settings/account/api-keys", icon: KeyRound },
      { title: "Users & Groups", href: "/settings/access/users", icon: User2, adminOnly: true },
      { title: "SSO Providers", href: "/settings/access/sso-providers", icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    title: "Integrations",
    items: [
      { title: "S3 Targets", href: "/settings/integrations/s3-targets", icon: Box, adminOnly: true },
      { title: "LLM Gateways", href: "/settings/integrations/llm-gateways", icon: Boxes, adminOnly: true },
    ],
  },
]

export type ServerSettingsNavigationItem = {
  title: string
  tab: string
  icon: LucideIcon
}

export const serverSettingsNavigation: ServerSettingsNavigationItem[] = [
  { title: "Network & Domains", tab: "network", icon: Network },
  { title: "Storage & Backups", tab: "storage", icon: HardDrive },
  { title: "Builds", tab: "builds", icon: Hammer },
  { title: "Cluster", tab: "cluster", icon: Network },
  { title: "Updates & Add-Ons", tab: "updates", icon: Rocket },
  { title: "Operations & Maintenance", tab: "operations", icon: Wrench },
]

export const developerSettingsNavigation: SettingsNavigationItem[] = [
  { title: "REST API", href: "/settings/developer/rest-api", icon: ChevronsLeftRightEllipsis, adminOnly: true },
]

export function serverSettingsHref(tab: string) {
  return `/settings/platform/${tab}`
}
