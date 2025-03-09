import { Inter } from "next/font/google";
import { isAuthorizedReadForApp } from "@/server/utils/action-wrapper.utils";
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

  const appId = params?.appId;
  if (!appId) {
    return <p>Could not find app with id {appId}</p>
  }
  const session = await isAuthorizedReadForApp(appId);
  const app = await appService.getExtendedById(appId);

  return (
    <div className="flex-1 space-y-6 pt-6">
      <PageTitle
        title={app.name}
        subtitle={`App ID: ${app.id}`}>
      </PageTitle>
      <AppActionButtons session={session} app={app} />
      {children}
    </div>
  );
}

