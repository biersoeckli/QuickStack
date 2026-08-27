'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useConfirmDialog } from '@/frontend/states/zustand.states';
import { Toast } from '@/frontend/utils/toast.utils';
import { AddonLifecycleStatus } from '@/shared/model/cluster-addon.model';
import { CheckCircle2, CircleAlert, Download, ExternalLink, LoaderCircle, MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { installClusterAddon, uninstallClusterAddon, updateClusterAddon } from './actions';

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

const statusLabel: Record<AddonLifecycleStatus, string> = {
    notInstalled: 'Not installed', installing: 'Installing', ready: 'Installed',
    updating: 'Updating', uninstalling: 'Uninstalling', failed: 'Error',
};

export default function ClusterAddonUpdateInfo({ addon }: { addon: ClusterAddonUpdateInfo }) {
    const { openConfirmDialog } = useConfirmDialog();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const busy = ['installing', 'updating', 'uninstalling'].includes(addon.status);
    const canInstall = addon.status === 'notInstalled' || (addon.status === 'failed' && !addon.installedVersion);
    const canUpdate = addon.status === 'ready' && !!addon.availableVersion;
    const canRemove = addon.canUninstall && (addon.status === 'ready' || addon.status === 'failed') && !!addon.installedVersion;

    const runOperation = async (operation: 'install' | 'update' | 'remove') => {
        const version = operation === 'update' ? ` to ${addon.availableVersion}` : '';
        const actionLabel = operation === 'remove' ? 'Remove' : operation === 'install' ? 'Install' : 'Update';
        const confirmed = await openConfirmDialog({
            title: `${actionLabel} ${addon.displayName}`,
            description: operation === 'remove'
                ? `Do you want to remove ${addon.displayName}? QuickStack will delete the add-on's Kubernetes resources from this cluster. This cannot be undone.`
                : operation === 'update' && addon.updateWarning
                    ? <div className="space-y-3">
                        <p>{`Do you want to update ${addon.displayName}${version}? QuickStack will apply the add-on's Kubernetes resources to this cluster.`}</p>
                        <div>
                            <p className="text-sm font-semibold text-orange-600">{addon.updateWarning.title}</p>
                            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                                {addon.updateWarning.items.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                        </div>
                    </div>
                : `Do you want to ${operation} ${addon.displayName}${version}? QuickStack will apply the add-on's Kubernetes resources to this cluster.`,
            okButton: actionLabel,
        });
        if (!confirmed) return;

        try {
            setLoading(true);
            await Toast.fromAction(
                () => operation === 'install' ? installClusterAddon(addon.id) : operation === 'update' ? updateClusterAddon(addon.id) : uninstallClusterAddon(addon.id),
                undefined,
                `${operation === 'install' ? 'Installing' : operation === 'update' ? 'Updating' : 'Removing'} ${addon.displayName}...`,
            );
            router.refresh();
        } finally {
            setLoading(false);
        }
    };

    return <Card>
        <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <CardTitle>{addon.displayName}</CardTitle>
                    <CardDescription>{addon.description}</CardDescription>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${addon.status === 'failed' ? 'bg-destructive text-destructive-foreground' : addon.status === 'ready' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                    {busy && <LoaderCircle className="mr-1 h-3 w-3 animate-spin" />}
                    {statusLabel[addon.status]}
                </span>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Installed version</p>
                <p className="font-medium">{addon.installedVersion ?? '—'}</p>
            </div>
            {addon.message && <Alert variant={addon.status === 'failed' ? 'destructive' : 'default'}><CircleAlert className="h-4 w-4" /><AlertDescription>{addon.message}</AlertDescription></Alert>}
            {canUpdate && <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <p className="text-sm font-medium">Next Version Available</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">{addon.availableVersion}</p>
                    <Button disabled={loading} size="sm" className="w-full gap-2" onClick={() => runOperation('update')}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Update to {addon.availableVersion}
                    </Button>
                </div>
            </div>}
            <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {canInstall && <Button disabled={loading} onClick={() => runOperation('install')}><Download className="mr-2 h-4 w-4" />Install</Button>}
                    {addon.status === 'ready' && !addon.availableVersion && <span className="flex items-center text-sm text-muted-foreground"><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />Up to date</span>}
                    <Button asChild size="sm" variant="outline"><Link href={addon.documentationUrl} target="_blank"><ExternalLink className="mr-2 h-4 w-4" />Documentation</Link></Button>
                </div>
                {canRemove && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={loading}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Add-on actions</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive" onClick={() => runOperation('remove')}>
                            <Trash2 /> Remove
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>}
            </div>
        </CardContent>
    </Card>;
}
