import { isAuthorizedReadForApp } from "@/server/utils/action-wrapper.utils";
import appService from "@/server/services/app.service";
import PageTitle from "@/components/custom/page-title";
import AppActionButtons from "./app-action-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

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

    const showIngressWarning = app.appDomains.length > 0 && app.ingressNetworkPolicy !== 'ALLOW_ALL';

  return (
    <div className="flex-1 space-y-6 pt-6">
      <PageTitle
        title={app.name}
        subtitle={`App ID: ${app.id}`}>
      </PageTitle>
            {showIngressWarning && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                        You have configured domains for this app, but the Ingress Network Policy is not set to &quot;Allow All&quot;.
                        External traffic via the domain might be blocked.
                    </AlertDescription>
                </Alert>
            )}
      <AppActionButtons session={session} app={app} />
      {children}
    </div>
  );
}

