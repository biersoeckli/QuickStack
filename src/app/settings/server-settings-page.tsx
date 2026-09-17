import BreadcrumbSetter from "@/components/breadcrumbs-setter"
import PageTitle from "@/components/custom/page-title"

export function ServerSettingsPage({
  title,
  category = "Platform",
  categoryHref = "/settings/platform/network",
  actions,
  children,
}: {
  title: string
  category?: string
  categoryHref?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return <div className="flex-1 space-y-6 pt-6 pb-16">
    <div className="space-y-0.5">
      <PageTitle title={title} subtitle={`${category} settings`}>{actions}</PageTitle>
    </div>
    <BreadcrumbSetter items={[
      { name: "Settings", url: "/settings/account/profile" },
      { name: category, url: categoryHref },
      { name: title },
    ]} />
    {children}
  </div>
}
