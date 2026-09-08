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
  params: Promise<{ appId: string }>
  children: React.ReactNode;
}>) {

  const resolvedParams = await params;
  const appId = resolvedParams?.appId;
  if (!appId) {
    return <p>Could not find app with id {appId}</p>
  }
  const session = await isAuthorizedReadForApp(appId);
  const app = await appService.getExtendedById(appId);

  const hasIngressRule = (app.appNetworkPolicy?.rules ?? []).some(rule => rule.type === 'INGRESS');
  const showIngressWarning = app.useNetworkPolicy && app.appDomains.length === 0 && !hasIngressRule;

  return (
    <div className="flex-1 space-y-6 pt-6">
      <PageTitle
        title={app.name}
        subtitle={`App ID: ${app.id}`}>
      </PageTitle>
      {showIngressWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No inbound traffic configured</AlertTitle>
          <AlertDescription>
            This app has no domain and no ingress network policy rule. It accepts no incoming traffic and cannot be reached
            from other apps. Configure network policies to allow inbound connections.
          </AlertDescription>
        </Alert>
      )}
      <AppActionButtons session={session} app={app} />
      {children}
    </div>
  );
}
