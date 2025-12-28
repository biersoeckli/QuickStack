'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { setCanaryChannel, updateQuickstack } from "./actions";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Rocket, ExternalLink } from "lucide-react";
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import React from "react";
import { GithubReleaseInfo } from "@/server/adapter/github.adapter";
import Link from "next/link";

export default function QuickStackVersionInfo({
    useCanaryChannel,
    currentVersion,
    newVersionInfo
}: {
    useCanaryChannel: boolean;
    currentVersion?: string;
    newVersionInfo?: GithubReleaseInfo
}) {

    const useConfirm = useConfirmDialog();
    const [loading, setLoading] = React.useState(false);

    const handleUpdate = async () => {
        if (await useConfirm.openConfirmDialog({
            title: 'Update QuickStack',
            description: 'This action will restart the QuickStack service and installs the latest version. It may take a few minutes to complete.',
            okButton: "Update QuickStack",
        })) {
            Toast.fromAction(() => updateQuickstack());
        }
    };

    return <>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    QuickStack Version
                </CardTitle>
                <CardDescription>Manage your QuickStack version and update channel preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Current Version</p>
                            <p className="text-2xl font-bold">{currentVersion ?? 'unknown'}</p>
                        </div>
                        {newVersionInfo && (
                            <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 cursor-pointer" onClick={handleUpdate}>
                                    <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                                    <span className="text-xs font-medium text-primary">Update Available</span>
                                </div>
                                <div className="text-sm text-muted-foreground flex gap-1">
                                    <span>Version {newVersionInfo.version} | </span>
                                    <Link href={newVersionInfo.url} target="_blank" className="flex gap-1 items-center hover:underline">
                                        <ExternalLink className=" h-4 w-4" />
                                        View Release Notes
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                        <div className="space-y-0.5">
                            <Label htmlFor="canary-channel-mode" className="text-base cursor-pointer">
                                Canary Channel
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Get early access to experimental features and updates (not recommended for production environments).
                            </p>
                        </div>
                        <Switch
                            id="canary-channel-mode"
                            disabled={loading}
                            checked={useCanaryChannel}
                            onCheckedChange={async (checked) => {
                                // Show warning when enabling canary channel
                                if (checked) {
                                    const confirmed = await useConfirm.openConfirmDialog({
                                        title: 'Enable Canary Channel',
                                        description: 'Canary channel provides early access to experimental features and updates. These versions may contain bugs, make your QuickStack cluster unusable and are not recommended for production environments. Are you sure you want to continue?',
                                        okButton: "Enable Canary Channel",
                                    });

                                    if (!confirmed) {
                                        return;
                                    }
                                }

                                try {
                                    setLoading(true);
                                    Toast.fromAction(() => setCanaryChannel(checked));
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        />
                    </div>
                </div>


            </CardContent>
            <CardFooter className="flex justify-between items-center border-t pt-6">
                {useCanaryChannel ?
                    <p className="text-sm text-muted-foreground">
                        Cannot check for updates while on the canary channel.
                    </p> :
                    <p className="text-sm text-muted-foreground">
                        {newVersionInfo ? 'Update to the latest version' : 'You are up to date'}
                    </p>}
                <Button
                    disabled={loading}
                    onClick={handleUpdate}
                    size="lg"
                    className="gap-2"
                >
                    <Rocket className="h-4 w-4" />
                    Update QuickStack
                </Button>
            </CardFooter>
        </Card >
    </>;
}