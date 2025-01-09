'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanupOldBuildJobs, purgeRegistryImages, updateQuickstack, updateRegistry } from "../server/actions";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { LogsDialog } from "@/components/custom/logs-overlay";
import { Constants } from "@/shared/utils/constants";
import { Rocket, RotateCcw, SquareTerminal, Trash } from "lucide-react";

export default function QuickStackMaintenanceSettings({
    qsPodName
}: {
    qsPodName?: string;
}) {

    const useConfirm = useConfirmDialog();

    return <div className="space-y-4">
        <Card>
            <CardHeader>
                <CardTitle>Free Up Disk Space</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">

                <Button variant="secondary" onClick={async () => {
                    if (await useConfirm.openConfirmDialog({
                        title: 'Purge Images',
                        description: 'This action deletes all build images from the internal QuickStack container registry. Use this action to free up disk space.',
                        okButton: "Purge Images",
                    })) {
                        Toast.fromAction(() => purgeRegistryImages());
                    }
                }}><Trash /> Purge Images</Button>

                <Button variant="secondary" onClick={async () => {
                    if (await useConfirm.openConfirmDialog({
                        title: 'Cleanup Old Build Jobs',
                        description: 'This action deletes all old build jobs. Use this action to free up disk space.',
                        okButton: "Cleanup Old Build Jobs"
                    })) {
                        Toast.fromAction(() => cleanupOldBuildJobs());
                    }
                }}><Trash /> Cleanup Old Build Jobs</Button>


            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Monitoring & Troubleshooting</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">

                {qsPodName && <LogsDialog namespace={Constants.QS_NAMESPACE} podName={qsPodName}>
                    <Button variant="secondary" ><SquareTerminal /> Open QuickStack Logs</Button>
                </LogsDialog>}

                <Button variant="secondary" onClick={async () => {
                    if (await useConfirm.openConfirmDialog({
                        title: 'Update Registry',
                        description: 'This action will restart the internal QuickStack container registry.',
                        okButton: "Update Registry"
                    })) {
                        Toast.fromAction(() => updateRegistry());
                    }
                }}><RotateCcw /> Force Update Registry</Button>

            </CardContent>
        </Card>
    </div>;
}