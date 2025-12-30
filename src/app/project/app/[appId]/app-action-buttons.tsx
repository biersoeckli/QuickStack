'use client'

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deploy, startApp, stopApp } from "./actions";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Toast } from "@/frontend/utils/toast.utils";
import { ExternalLink, Hammer, Pause, Play, Rocket, Square } from "lucide-react";
import { AppEventsDialog } from "./app-events-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { UserSession } from "@/shared/model/sim-session.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import PodStatusIndicator from "@/components/custom/pod-status-indicator";
import { usePodsStatus } from "@/frontend/states/zustand.states";
import { useEffect, useState } from "react";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";

export default function AppActionButtons({
    app,
    session
}: {
    app: AppExtendedModel;
    session: UserSession;
}) {
    const [deploymentStatus, setDeploaymentStatus] = useState<DeploymentStatus>('UNKNOWN');
    const hasWriteAccess = UserGroupUtils.sessionHasWriteAccessForApp(session, app.id);
    const { subscribeToStatusChanges, getPodsForApp } = usePodsStatus();

    useEffect(() => {
        const pods = getPodsForApp(app.id);
        setDeploaymentStatus(pods?.deploymentStatus ?? 'UNKNOWN');

        const unsubscribe = subscribeToStatusChanges((changedAppIds) => {
            if (changedAppIds.includes(app.id)) {
                const pods = getPodsForApp(app.id);
                setDeploaymentStatus(pods?.deploymentStatus ?? 'UNKNOWN');
            }
        });
        return () => unsubscribe();
    }, [app.id]);

    return <Card>
        <CardContent className="p-4 ">
            <ScrollArea>
                <div className="flex gap-4">
                    <div className="self-center"><AppEventsDialog app={app}><PodStatusIndicator appId={app.id} /></AppEventsDialog></div>
                    {hasWriteAccess && <><Button onClick={() => Toast.fromAction(() => deploy(app.id))}><Rocket /> Deploy</Button>
                        {app.appType === 'APP' && app.sourceType === 'GIT' && <Button onClick={() => Toast.fromAction(() => deploy(app.id, true))} variant="secondary"><Hammer /> Rebuild</Button>}
                        <Button disabled={!['ERROR', 'UNKNOWN', 'SHUTDOWN', 'SHUTTING_DOWN'].includes(deploymentStatus)} onClick={() => Toast.fromAction(() => startApp(app.id))} variant="secondary"><Play />Start</Button>
                        <Button disabled={!['BUILDING', 'DEPLOYED', 'ERROR', 'UNKNOWN', 'DEPLOYING'].includes(deploymentStatus)} onClick={() => Toast.fromAction(() => stopApp(app.id))} variant="secondary"><Square /> Stop</Button>
                    </>}
                    {app.appDomains.length > 0 && <Button onClick={() => {
                        const domain = app.appDomains[0];
                        const protocol = domain.useSsl ? 'https' : 'http';
                        window.open(`${protocol}://${domain.hostname}`, '_blank');
                    }} variant="secondary"><ExternalLink /></Button>}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </CardContent>
    </Card >;
}