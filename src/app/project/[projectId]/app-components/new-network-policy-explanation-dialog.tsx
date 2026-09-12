'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDialogContext } from '@/frontend/states/dialog-context';
import { Toast } from '@/frontend/utils/toast.utils';
import { acknowledgeNewNetworkPolicyExplanation } from '../actions';

export default function NewNetworkPolicyExplanationDialog() {
    const { closeDialog } = useDialogContext();
    const [saving, setSaving] = useState(false);

    const acknowledge = async () => {
        setSaving(true);
        try {
            await Toast.fromAction(
                acknowledgeNewNetworkPolicyExplanation,
                'Network policy information acknowledged.',
                'Saving...',
            );
            closeDialog(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>New: Explicit connections between apps</DialogTitle>
                <DialogDescription>
                    Network Policies now give you direct control over which apps can communicate.
                </DialogDescription>
            </DialogHeader>

            <video
                className="aspect-video w-full rounded-lg border bg-muted object-cover"

                muted
                playsInline
                loop
                autoPlay
                no-controls
                preload="metadata"
            >
                <source src="/media/manual-videos/quick-manual-network-policies.webm" type="video/webm" />
                Your browser does not support embedded videos.
            </video>

            <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                    Connections between apps must now be created explicitly. The video shows how to connect two apps in the project network graph.
                </p>
                <p>
                    If you used QuickStack before this change, your existing Network Policies were migrated automatically. The migration may have created more connections than you need, so please review the graph and adjust them if necessary.
                </p>
            </div>

            <DialogFooter>
                <Button onClick={acknowledge} disabled={saving}>
                    {saving ? 'Saving...' : 'OK'}
                </Button>
            </DialogFooter>
        </>
    );
}
