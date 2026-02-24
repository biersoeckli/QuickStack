'use client';

import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Code } from '@/components/custom/code';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Toast } from '@/frontend/utils/toast.utils';
import { Actions } from '@/frontend/utils/nextjs-actions.utils';
import { useConfirmDialog } from '@/frontend/states/zustand.states';
import {
    disableLonghornUiIngress,
    enableLonghornUiIngress,
    getLonghornUiCredentials,
    getLonghornUiIngressStatus,
} from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HardDrive } from 'lucide-react';

export default function LonghornUiToggle() {
    const { openConfirmDialog } = useConfirmDialog();
    const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
    const [loading, setLoading] = useState(false);

    const loadStatus = async () => {
        const active = await Actions.run(() => getLonghornUiIngressStatus());
        setIsActive(active);
    };

    const showCredentialsDialog = async (credentials: { url: string; username: string; password: string }) => {
        await openConfirmDialog({
            title: 'Open Longhorn UI',
            description: (
                <>
                    Longhorn UI is ready and can be opened in a new tab.
                    <br />
                    Use the following credentials to log in:
                    <div className="pt-3 grid grid-cols-1 gap-1">
                        <Label>Username</Label>
                        <div><Code>{credentials.username}</Code></div>
                    </div>
                    <div className="pt-3 pb-4 grid grid-cols-1 gap-1">
                        <Label>Password</Label>
                        <div><Code>{credentials.password}</Code></div>
                    </div>
                    <div>
                        <Button variant="outline" onClick={() => window.open(credentials.url, '_blank')}>
                            Open Longhorn UI
                        </Button>
                    </div>
                </>
            ),
            okButton: '',
            cancelButton: 'Close',
        });
    };

    const openLonghornUi = async () => {
        try {
            setLoading(true);
            const credentials = await Actions.run(() => getLonghornUiCredentials());
            setLoading(false);
            if (credentials) {
                await showCredentialsDialog(credentials);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (checked: boolean) => {
        try {
            setLoading(true);
            if (checked) {
                const result = await Toast.fromAction(
                    () => enableLonghornUiIngress(),
                    'Longhorn UI access enabled',
                    'Enabling Longhorn UI access...'
                );
                await loadStatus();
                if (result?.data) {
                    await showCredentialsDialog(result.data);
                }
            } else {
                await Toast.fromAction(
                    () => disableLonghornUiIngress(),
                    'Longhorn UI access disabled',
                    'Disabling Longhorn UI access...'
                );
                await loadStatus();
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
        return () => {
            setIsActive(undefined);
        };
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Longhorn UI Access
                </CardTitle>
                <CardDescription>
                    Enable access to the Longhorn UI via a password authentication. This is only recommended for advanced users.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center space-x-3">
                        <Switch
                            disabled={loading || isActive === undefined}
                            checked={isActive ?? false}
                            onCheckedChange={handleToggle}
                        />
                        <Label>Longhorn UI Access</Label>
                    </div>
                    {isActive && (
                        <Button variant="outline" onClick={openLonghornUi} disabled={loading}>
                            Open Longhorn UI
                        </Button>
                    )}
                    {(loading || isActive === undefined) && <LoadingSpinner />}
                </div>
            </CardContent>
        </Card >
    );
}
