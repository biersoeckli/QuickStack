'use client'

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deploy, startApp, stopApp } from "./actions";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Toast } from "@/frontend/utils/toast.utils";
import { ExternalLink, Hammer, Pause, Play, Rocket } from "lucide-react";
import { AppEventsDialog } from "./app-events-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { UserSession } from "@/shared/model/sim-session.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import PodStatusIndicator from "@/components/custom/pod-status-indicator";

export default function AppActionButtons({
    app,
    session
}: {
    app: AppExtendedModel;
    session: UserSession;
}) {
    const hasWriteAccess = UserGroupUtils.sessionHasWriteAccessForApp(session, app.id);
    return <Card>
        <CardContent className="p-4 ">
            <ScrollArea>
                <div className="flex gap-4">
                    <div className="self-center"><AppEventsDialog app={app}><PodStatusIndicator appId={app.id} /></AppEventsDialog></div>
                    {hasWriteAccess && <><Button onClick={() => Toast.fromAction(() => deploy(app.id))}><Rocket /> Deploy</Button>
                        <Button onClick={() => Toast.fromAction(() => deploy(app.id, true))} variant="secondary"><Hammer /> Rebuild</Button>
                        <Button onClick={() => Toast.fromAction(() => startApp(app.id))} variant="secondary"><Play />Start</Button>
                        <Button onClick={() => Toast.fromAction(() => stopApp(app.id))} variant="secondary"><Pause /> Stop</Button>
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