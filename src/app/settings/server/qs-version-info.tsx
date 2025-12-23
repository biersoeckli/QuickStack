'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { purgeRegistryImages, setCanaryChannel, updateQuickstack, updateRegistry } from "./actions";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { LogsDialog } from "@/components/custom/logs-overlay";
import { Constants } from "@/shared/utils/constants";
import { Rocket, RotateCcw, SquareTerminal, Trash } from "lucide-react";
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import React from "react";

export default function QuickStackVersionInfo({
    useCanaryChannel,
    currentVersion
}: {
    useCanaryChannel: boolean;
    currentVersion?: string;
}) {

    const useConfirm = useConfirmDialog();
    const [loading, setLoading] = React.useState(false);

    return <>
        <Card>
            <CardHeader>
                <CardTitle>QuickStack Version</CardTitle>
                <CardDescription>Update your QuickStack cluster or change to the experimental Canary version.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">


                <div className="flex items-center space-x-2 pl-1">
                    <Switch id="canary-channel-mode" disabled={loading} checked={useCanaryChannel} onCheckedChange={(checked) => {
                        try {
                            setLoading(true);
                            Toast.fromAction(() => setCanaryChannel(checked));
                        } finally {
                            setLoading(false);
                        }
                    }} />
                    <Label htmlFor="canary-channel-mode">Use Canary Channel for Updates</Label>
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="secondary" disabled={loading} onClick={async () => {
                        if (await useConfirm.openConfirmDialog({
                            title: 'Update QuickStack',
                            description: 'This action will restart the QuickStack service and installs the lastest version. It may take a few minutes to complete.',
                            okButton: "Update QuickStack",
                        })) {
                            Toast.fromAction(() => updateQuickstack());
                        }
                    }}><Rocket /> Update QuickStack</Button>
                    <p className="text-slate-500 text-sm flex-1 text-right">Installed: {currentVersion ?? 'unknown'}</p>

                </div>
            </CardContent>
        </Card >
    </>;
}