'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanupOldBuildJobs, cleanupOldTmpFiles, deleteAllFailedAndSuccededPods, deleteAllNetworkPolicies, deleteOldAppLogs, purgeRegistryImages, updateRegistry } from "../server/actions";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { LogsDialog } from "@/components/custom/logs-overlay";
import { Constants } from "@/shared/utils/constants";
import { RotateCcw, SquareTerminal, Trash, ShieldOff } from "lucide-react";

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
                        okButton: "Cleanup"
                    })) {
                        Toast.fromAction(() => cleanupOldBuildJobs());
                    }
                }}><Trash /> Cleanup Old Build Jobs</Button>

                <Button variant="secondary" onClick={async () => {
                    if (await useConfirm.openConfirmDialog({
                        title: 'Cleanup Temp Files',
                        description: 'This action deletes all temporary files. Use this action to free up disk space.',
                        okButton: "Cleanup"
                    })) {
                        Toast.fromAction(() => cleanupOldTmpFiles());
                    }
                }}><Trash /> Cleanup Temp Files</Button>

                <Button variant="secondary" onClick={async () => {
                    if (await useConfirm.openConfirmDialog({
                        title: 'Delete old App logs',
                        description: 'This action deletes all old app logs. Use this action to free up disk space.',
                        okButton: "Delete old App logs"
                    })) {
                        Toast.fromAction(() => deleteOldAppLogs());
                    }
                }}><Trash /> Delete old App logs</Button>

                <Button variant="secondary" onClick={async () => {
                    if (await useConfirm.openConfirmDialog({
                        title: 'Delete Orphaned Containers',
                        description: 'This action deletes all unused pods (failed or succeded). Use this action to free up resources.',
                        okButton: "Delete Orphaned Containers"
                    })) {
                        Toast.fromAction(() => deleteAllFailedAndSuccededPods());
                    }
                }}><Trash /> Delete Orphaned Containers</Button>
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
        <Card>
            <CardHeader>
                <CardTitle>Network Policies</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">

                <Button variant="destructive" onClick={async () => {
                    if (await useConfirm.openConfirmDialog({
                        title: '⚠️ Delete All Network Policies',
                        description: 'WARNING: This is a bad idea! This action will delete ALL network policies across all namespaces. Your applications will lose all network security restrictions. Only use this for troubleshooting or emergency situations. Are you absolutely sure?',
                        okButton: "Yes, Delete All Policies",
                    })) {
                        Toast.fromAction(() => deleteAllNetworkPolicies());
                    }
                }}><ShieldOff /> Delete All Network Policies</Button>

            </CardContent>
        </Card>
    </div>;
}