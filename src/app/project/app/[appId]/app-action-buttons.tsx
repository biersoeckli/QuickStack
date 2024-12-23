'use client'

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deploy, startApp, stopApp } from "./actions";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Toast } from "@/frontend/utils/toast.utils";
import AppStatus from "./app-status";
import { Hammer, Pause, Play, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AppEventsDialog } from "./app-events-dialog";

export default function AppActionButtons({
    app
}: {
    app: AppExtendedModel;
}) {
    return <Card>
        <CardContent className="p-4 flex gap-4">
            <div className="self-center"><AppEventsDialog app={app}><AppStatus appId={app.id} /></AppEventsDialog></div>
            <Button onClick={() => Toast.fromAction(() => deploy(app.id))}><Rocket /> Deploy</Button>
            <Button onClick={() => Toast.fromAction(() => deploy(app.id, true))} variant="secondary"><Hammer /> Rebuild</Button>
            <Button onClick={() => Toast.fromAction(() => startApp(app.id))} variant="secondary"><Play />Start</Button>
            <Button onClick={() => Toast.fromAction(() => stopApp(app.id))} variant="secondary"><Pause /> Stop</Button>
        </CardContent>
    </Card >;
}