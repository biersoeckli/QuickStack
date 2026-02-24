'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startLonghornUpgrade } from "./actions";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { RefreshCw, ExternalLink, CheckCircle2, AlertCircle, HardDrive } from "lucide-react";
import React from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { LonghornReleaseInfo } from "@/server/adapter/qs-versioninfo.adapter";

export default function LonghornUpdateInfo({
    longhornInstalled,
    longhornCurrentVersionInfo,
    longhornNextVersionInfo,
    longhornUpgradeIsInProgress,
}: {
    longhornInstalled: boolean;
    longhornCurrentVersionInfo?: LonghornReleaseInfo;
    longhornNextVersionInfo?: LonghornReleaseInfo;
    longhornUpgradeIsInProgress: boolean;
}) {

    const useConfirm = useConfirmDialog();
    const [loading, setLoading] = React.useState(false);
    const [upgradeInProgress, setUpgradeInProgress] = React.useState(longhornUpgradeIsInProgress);

    const handleUpgrade = async () => {
        if (await useConfirm.openConfirmDialog({
            title: 'Start Longhorn Storage Upgrade',
            description: (
                <div className="space-y-3">
                    <p className="text-sm font-semibold text-orange-600">
                        ⚠️ Warning: This will upgrade Longhorn to version {longhornNextVersionInfo?.version}.
                    </p>
                    <p className="text-sm">
                        Before proceeding, ensure that:
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                        <li>All critical data has been backed up</li>
                        <li>Volume backups are configured and recent</li>
                        <li>No critical workloads are running that cannot tolerate brief interruptions</li>
                        <li>You have reviewed the release notes for breaking changes</li>
                    </ul>
                    <p className="text-sm">
                        The upgrade process will:
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                        <li>Upgrade the Longhorn manager components</li>
                        <li>Automatically upgrade volume engines (based on settings)</li>
                        <li>Attached volumes will be live-upgraded</li>
                        <li>Detached volumes will be offline-upgraded</li>
                    </ul>
                    <p className="text-sm font-medium">
                        Are you sure you want to proceed with the upgrade?
                    </p>
                </div>
            ),
            okButton: "Start Upgrade",
        })) {
            try {
                setLoading(true);
                await Toast.fromAction(() => startLonghornUpgrade());
                setUpgradeInProgress(true);
            } finally {
                setLoading(false);
            }
        }
    };

    if (!longhornInstalled) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5" />
                        Longhorn Storage Upgrades
                    </CardTitle>
                    <CardDescription>
                        Longhorn is not installed in this cluster.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Longhorn storage system is not detected. It may not be installed or is not accessible.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Longhorn Storage Upgrades
                </CardTitle>
                <CardDescription>
                    Longhorn provides distributed block storage for your Kubernetes cluster.
                    Keep it up-to-date for improved performance, stability, and new features.
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <QuestionMarkCircledIcon />
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="space-y-3 max-w-xl">
                                    <h4 className="text-sm font-medium">About Longhorn Upgrades</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Longhorn upgrades are performed by applying the new Longhorn manifest to your cluster.
                                        The upgrade process will update all Longhorn components including the manager, engine, and UI.
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        <strong>Volume Engine Upgrades:</strong> After upgrading Longhorn manager, volume engines
                                        are automatically upgraded.
                                        Attached volumes are live-upgraded while detached volumes are offline-upgraded.
                                    </p>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Link
                                            href="https://longhorn.io/docs/latest/deploy/upgrade/"
                                            target="_blank"
                                            className="flex items-center gap-1 text-primary hover:underline"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            View Longhorn Upgrade Documentation
                                        </Link>
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/50 p-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Current Longhorn Version</p>
                            </div>
                            {longhornCurrentVersionInfo ? (
                                <div className="space-y-1">
                                    <p className="text-2xl font-bold">{longhornCurrentVersionInfo.version}</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Version information not available</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {upgradeInProgress ? (
                        <Alert className="text-orange-600 border-orange-400">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <AlertDescription>
                                A Longhorn upgrade is currently in progress.
                                The manager pods are being updated. Volume engines will be upgraded automatically afterwards.
                                Refresh this page to check the completion status.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            {longhornNextVersionInfo && (
                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            <p className="text-sm font-medium">Next Version Available</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-2xl font-bold text-primary">{longhornNextVersionInfo.version}</p>
                                        </div>
                                        <Button
                                            disabled={loading}
                                            size="sm"
                                            className="w-full gap-2"
                                            onClick={handleUpgrade}
                                        >
                                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                            Upgrade to {longhornNextVersionInfo.version}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {longhornNextVersionInfo === undefined && (
                                <Alert>
                                    <AlertDescription>
                                        Your cluster is running the latest available Longhorn version which is compatible with QuickStack.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
