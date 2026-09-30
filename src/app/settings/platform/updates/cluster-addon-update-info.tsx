'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useDialog } from '@/frontend/states/zustand.states';
import { AddonLifecycleStatus } from '@/shared/model/cluster-addon.model';
import {
    CheckCircle2,
    CircleAlert,
    Download,
    LoaderCircle,
    Package,
    RefreshCw,
} from 'lucide-react';
import { ClusterAddonDetailsDialog } from './cluster-addon-details-dialog';
import { cn } from 'cn';

export type ClusterAddonUpdateInfo = {
    id: string;
    displayName: string;
    description: string;
    documentationUrl: string;
    canUninstall: boolean;
    updateWarning?: {
        title: string;
        items: string[];
    };
    status: AddonLifecycleStatus;
    installedVersion?: string;
    availableVersion?: string;
    message?: string;
};

export const statusLabel: Record<AddonLifecycleStatus, string> = {
    notInstalled: 'Not installed',
    installing: 'Installing',
    ready: 'Installed',
    updating: 'Updating',
    uninstalling: 'Uninstalling',
    failed: 'Error',
};

export default function ClusterAddonUpdateInfo({ addon }: { addon: ClusterAddonUpdateInfo }) {
    const { openDialog } = useDialog();
    const busy = ['installing', 'updating', 'uninstalling'].includes(addon.status);
    const hasAvailableUpdate = addon.status === 'ready' && !!addon.availableVersion;

    const statusIcon = hasAvailableUpdate
        ? <RefreshCw className="size-3.5" />
        : busy
        ? <LoaderCircle className="size-3.5 animate-spin" />
        : addon.status === 'failed'
            ? <CircleAlert className="size-3.5" />
            : addon.status === 'ready'
                ? <CheckCircle2 className="size-3.5" />
                : <Download className="size-3.5" />;

    const updateLabel = addon.availableVersion
        ? `Update ${addon.availableVersion} available`
        : addon.status === 'ready'
            ? 'Up to date'
            : 'No update available';

    return (
        <Card className="p-0 transition-shadow hover:shadow-md">
            <button
                type="button"
                className="h-full w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => openDialog(
                    <ClusterAddonDetailsDialog addon={addon} />,
                    { maxWidth: '620px' },
                )}
            >
                <CardContent className="flex h-full min-h-44 flex-col gap-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Package className="size-5" />
                        </div>
                        <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                            hasAvailableUpdate
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                                : addon.status === 'failed'
                                    ? 'bg-destructive text-destructive-foreground'
                                    : addon.status === 'ready'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-secondary text-secondary-foreground',
                        )}>
                            {statusIcon}
                            {hasAvailableUpdate ? 'Update available' : statusLabel[addon.status]}
                        </span>
                    </div>
                    <div className="space-y-1">
                        <p className="font-medium">{addon.displayName}</p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                            {addon.description}
                        </p>
                    </div>
                    <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                        {addon.availableVersion
                            ? <RefreshCw className="size-3.5 text-primary" />
                            : addon.status === 'ready'
                                ? <CheckCircle2 className="size-3.5 text-green-500" />
                                : null}
                        <span>{updateLabel}</span>
                    </div>
                </CardContent>
            </button>
        </Card>
    );
}
