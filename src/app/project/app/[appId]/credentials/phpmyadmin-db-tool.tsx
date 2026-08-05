import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";
import { DbToolIds, deleteDbToolDeploymentForAppIfExists, deployDbTool, getIsDbToolActive, getLoginCredentialsForRunningDbTool } from "./actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Code } from "@/components/custom/code";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function DbToolSwitch({
    app,
    toolId,
    toolNameString
}: {
    app: AppExtendedModel;
    toolId: DbToolIds;
    toolNameString: string;
}) {

    const { openConfirmDialog } = useConfirmDialog();
    const [isDbToolActive, setIsDbToolActive] = useState<boolean | undefined>(undefined);
    const [loading, setLoading] = useState(false);

    const loadIdDbToolActive = useCallback(async (appId: string) => {
        const response = await Actions.run(() => getIsDbToolActive(appId, toolId));
        setIsDbToolActive(response);
    }, [toolId])

    const openDbTool = async () => {
        try {
            setLoading(true);
            const credentials = await Actions.run(() => getLoginCredentialsForRunningDbTool(app.id, toolId));
            setLoading(false);
            await openConfirmDialog({
                title: "Open DB Tool",
                description: <>
                    {toolNameString} is ready and can be opened in a new tab. <br />
                    Use the following credentials to login:
                    <div className="pt-3 grid grid-cols-1 gap-1">
                        <Label>Username</Label>
                        <div> <Code>{credentials.username}</Code></div>
                    </div>
                    <div className="pt-3 pb-4 grid grid-cols-1 gap-1">
                        <Label>Password</Label>
                        <div><Code>{credentials.password}</Code></div>
                    </div>
                    <div>
                        <Button variant='outline' onClick={() => window.open(credentials.url, '_blank')}>Open {toolNameString}</Button>
                    </div>
                </>,
                okButton: '',
                cancelButton: "Close"
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadIdDbToolActive(app.id);
        return () => {
            setIsDbToolActive(undefined);
        }
    }, [app, loadIdDbToolActive]);

    return <>
        <div className="flex gap-4 items-center">
            <div className="flex items-center space-x-3">
                <Switch id="canary-channel-mode" disabled={loading || isDbToolActive === undefined} checked={isDbToolActive} onCheckedChange={async (checked) => {
                    try {
                        setLoading(true);
                        if (checked) {
                            await Toast.fromAction(() => deployDbTool(app.id, toolId), `${toolNameString} is now activated`, `activating ${toolNameString}...`);
                        } else {
                            await Toast.fromAction(() => deleteDbToolDeploymentForAppIfExists(app.id, toolId), `${toolNameString} has been deactivated`, `Deactivating ${toolNameString}...`);
                        }
                        await loadIdDbToolActive(app.id);
                    } finally {
                        setLoading(false);
                    }
                }} />
                <Label htmlFor="airplane-mode">{toolNameString}</Label>
            </div>
            {isDbToolActive && <>
                <Button variant='outline' onClick={() => openDbTool()}
                    disabled={!isDbToolActive || loading}>Open {toolNameString}</Button>
            </>}
            {(loading || isDbToolActive === undefined) && <LoadingSpinner></LoadingSpinner>}
        </div>
    </>;
}
