import { Inter } from "next/font/google";
import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import appService from "@/server/services/app.service";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import PageTitle from "@/components/custom/page-title";
import AppActionButtons from "./app-action-buttons";

export default async function RootLayout({
  children,
  params
}: Readonly<{
  params: { appId: string }
  children: React.ReactNode;
}>) {

  await getAuthUserSession();
  const appId = params?.appId;
  if (!appId) {
    return <p>Could not find app with id {appId}</p>
  }
  const app = await appService.getExtendedById(appId);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/project?projectId=${app.projectId}`}>{app.project.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>{app.name}</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageTitle
        title={app.name}
        subtitle={`App ID: ${app.id}`}>
      </PageTitle>
      <AppActionButtons app={app} />
      {children}
    </div>
  );
}
