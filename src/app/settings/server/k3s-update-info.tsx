'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { checkK3sUpgradeControllerStatus, installK3sUpgradeController, startK3sUpgrade } from "./actions";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { RefreshCw, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import React from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuestionMarkCircledIcon, QuestionMarkIcon } from "@radix-ui/react-icons";
import { K3sReleaseInfo } from "@/server/adapter/qs-versioninfo.adapter";

export default function K3sUpdateInfo({
    initialControllerStatus,
    k3sCurrentVersionInfo,
    k3sNextVersionInfo,
    k3sUpgradeIsInProgress,
}: {
    initialControllerStatus: boolean;
    k3sCurrentVersionInfo?: K3sReleaseInfo;
    k3sNextVersionInfo?: K3sReleaseInfo;
    k3sUpgradeIsInProgress: boolean;
}) {

    const useConfirm = useConfirmDialog();
    const [loading, setLoading] = React.useState(false);
    const [controllerInstalled, setControllerInstalled] = React.useState(initialControllerStatus);
    const [upgradeInProgress, setUpgradeInProgress] = React.useState(k3sUpgradeIsInProgress);

    const handleInstallController = async () => {
        if (await useConfirm.openConfirmDialog({
            title: 'Install K3s System Upgrade Controller',
            description: 'This will install the system-upgrade-controller in the system-upgrade namespace. This controller is required for automated K3s cluster upgrades. Do you want to continue?',
            okButton: "Install Controller",
        })) {
            try {
                setLoading(true);
                await Toast.fromAction(() => installK3sUpgradeController());
                setControllerInstalled(true);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleCheckStatus = async () => {
        try {
            setLoading(true);
            const result = await checkK3sUpgradeControllerStatus();
            if (result.data && result.data !== undefined) {
                setControllerInstalled(result.data);
                toast.success(result.data ? 'Controller is installed' : 'Controller is not installed');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async () => {
        if (await useConfirm.openConfirmDialog({
            title: 'Start K3s Cluster Upgrade',
            description: (
                <div className="space-y-3">
                    <p className="text-sm font-semibold text-orange-600">
                        ⚠️ Warning: This will upgrade your K3s cluster to the version {k3sNextVersionInfo?.version} (latest available patch version).
                    </p>
                    <p className="text-sm">
                        Before proceeding, ensure that:
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                        <li>All critical data has been backed up</li>
                        <li>System backups are enabled and working</li>
                        <li>Volume backups are configured</li>
                        <li>You have a recovery plan in case of issues</li>
                    </ul>
                    <p className="text-sm">
                        The upgrade process will:
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                        <li>Upgrade control-plane/master-nodes first</li>
                        <li>Then upgrade worker nodes (one at a time)</li>
                        <li>Cordon and drain nodes during the process</li>
                        <li>Nodes are temporary down during the upgrade so expect some downtime</li>
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
                await Toast.fromAction(() => startK3sUpgrade());
                setUpgradeInProgress(true);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    K3s Cluster Upgrades
                </CardTitle>
                <CardDescription>
                    QuickStack uses k3s (Kubernetes distribution) under the hood for managing your cluster.
                    It is recommended to keep your k3s version up-to-date to benefit from the latest features and security patches.
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger >
                                <QuestionMarkCircledIcon />
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="space-y-3 max-w-xl">
                                    <h4 className="text-sm font-medium">About K3s Upgrades</h4>
                                    <p className="text-sm text-muted-foreground">
                                        K3s supports automated cluster upgrades through the System Upgrade Controller. QuickStack does not install this controller by default. You can install it below to enable automated upgrades.
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Once installed, the controller can keep your cluster on a chosen minor-version channel (for example <strong>v1.32</strong> or <strong>v1.33</strong>) and will automatically apply the latest patch releases within that channel. Moving between minor versions (for example <strong>v1.32 → v1.33</strong>) is a manual action you must trigger via the Update workflow (this UI).
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Before performing any upgrades, ensure QuickStack's System-Backup and Volume-Backup features are enabled to protect your cluster state and data.
                                    </p>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Link
                                            href="https://docs.k3s.io/upgrades/automated"
                                            target="_blank"
                                            className="flex items-center gap-1 text-primary hover:underline"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            View K3s Documentation
                                        </Link>
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {!controllerInstalled && (<>
                    <Alert className="text-orange-600 border-orange-400">
                        <AlertDescription>
                            The System Upgrade Controller is required for automated K3s cluster upgrades.
                            Install it below to enable k3s upgrades.
                        </AlertDescription>
                    </Alert>


                    <div className="rounded-lg border bg-muted/50 p-4">
                        <div className="flex items-center gap-4">
                            <div className="space-y-1 flex-1">
                                <p className="text-sm font-medium">System Upgrade Controller</p>
                                <div className="flex items-center gap-2 mt-2">
                                    {controllerInstalled ? (
                                        <>
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            <span className="text-sm text-muted-foreground">Installed and ready</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="h-5 w-5 text-orange-500" />
                                            <span className="text-sm text-muted-foreground">Not installed</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCheckStatus}
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Check Status
                            </Button>

                            {!controllerInstalled && <Button
                                disabled={loading}
                                size="sm"
                                onClick={handleInstallController}
                                className="gap-2"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Install Upgrade Controller
                            </Button>}
                        </div>
                    </div>
                </>)}

                {controllerInstalled && (
                    <div className="space-y-4">
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">Current K3s Version</p>
                                </div>
                                {k3sCurrentVersionInfo && (
                                    <div className="space-y-1">
                                        <p className="text-2xl font-bold">{k3sCurrentVersionInfo.version}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Channel: <Link target="_blank" href={k3sCurrentVersionInfo.channelUrl}>{k3sCurrentVersionInfo.channelUrl}</Link>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {upgradeInProgress ? <>
                            <Alert className="text-orange-600 border-orange-400">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                <AlertDescription>
                                    An upgrade is currently in progress.
                                    You can monitor the progress in the "Cluster" settings tab.
                                    Do not start another upgrade until the current one is complete.
                                    Refresh this page to check the overall completion status.
                                    This message will disappear once the upgrade is finished.
                                </AlertDescription>
                            </Alert>
                        </> : <>
                            {k3sNextVersionInfo && (
                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            <p className="text-sm font-medium">Next Version Available</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-2xl font-bold text-primary">{k3sNextVersionInfo.version}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Channel: <Link target="_blank" href={k3sNextVersionInfo.channelUrl}>{k3sNextVersionInfo.channelUrl}</Link>
                                            </p>
                                        </div>
                                        <Button
                                            disabled={loading}
                                            size="sm"
                                            className="w-full gap-2"
                                            onClick={handleUpgrade}
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            Upgrade to {k3sNextVersionInfo.version}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {k3sNextVersionInfo === undefined && (
                                <Alert>
                                    <AlertDescription>
                                        Your cluster is running the latest available K3s version wich is compatible with QuickStack.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
