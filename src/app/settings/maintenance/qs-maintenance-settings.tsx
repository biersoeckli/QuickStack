'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanupOldBuildJobs, cleanupOldTmpFiles, deleteAllFailedAndSuccededPods, deleteOldAppLogs, purgeRegistryImages, updateRegistry, updateTraefikMeCertificates } from "../server/actions";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { LogsDialog } from "@/components/custom/logs-overlay";
import { Constants } from "@/shared/utils/constants";
import { RotateCcw, SquareTerminal, Trash } from "lucide-react";

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


                <Button variant="secondary" onClick={async () => {
                    if (await useConfirm.openConfirmDialog({
                        title: 'Update Traefik.me SSL Certificates',
                        description: 'To use SSL with traefik.me domains, wildcard SSL certificates must be provided. Normally, this is done automatically. Use this action to force an update.',
                        okButton: "Update Certificates"
                    })) {
                        Toast.fromAction(() => updateTraefikMeCertificates());
                    }
                }}><RotateCcw />Update Traefik.me SSL Certificates</Button>


            </CardContent>
        </Card>
    </div>;
}