'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";
import { Toast } from "@/frontend/utils/toast.utils";
import { useCallback, useEffect, useState } from "react";
import { CreateApiKeyDialog } from "../profile/create-api-key-dialog";
import { adminDeleteApiKey, adminListApiKeys } from "./actions";

type ApiKey = { id: string; name: string; createdAt: Date; expiresAt: Date | null };

function OneTimeApiKeyDialog({ rawApiKey }: { rawApiKey: string }) {
    const { closeDialog } = useDialog();
    return <div className="space-y-4">
        <h3 className="text-lg font-semibold">REST API Key Created</h3>
        <p className="text-sm text-muted-foreground">Copy this key now. It will not be shown again.</p>
        <Input value={rawApiKey} readOnly />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => navigator.clipboard.writeText(rawApiKey)}>Copy</Button><Button onClick={() => closeDialog(true)}>Close</Button></div>
    </div>;
}

export function UserApiKeysDialog({ userId, userEmail }: { userId: string; userEmail: string }) {
    const { openDialog, closeDialog } = useDialog();
    const { openConfirmDialog } = useConfirmDialog();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

    const load = useCallback(async () => {
        const result = await Actions.run(() => adminListApiKeys(userId));
        setApiKeys(result as ApiKey[]);
    }, [userId]);
    useEffect(() => { void load(); }, [load]);

    const create = async () => {
        await openDialog(<CreateApiKeyDialog userId={userId} onCreated={async (rawApiKey) => {
            await openDialog(<OneTimeApiKeyDialog rawApiKey={rawApiKey} />, { maxWidth: '640px' });
            await load();
        }} />, { maxWidth: '480px' });
    };
    const remove = async (apiKeyId: string) => {
        if (await openConfirmDialog({ title: 'Delete REST API Key', description: 'Do you really want to delete this API key?', okButton: 'Delete' })) {
            await Toast.fromAction(() => adminDeleteApiKey(userId, apiKeyId));
            await load();
        }
    };

    return <div className="space-y-4">
        <div><h3 className="text-lg font-semibold">REST API Keys</h3><p className="text-sm text-muted-foreground">{userEmail}</p></div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {apiKeys.map(key => {
                const expired = !!key.expiresAt && new Date(key.expiresAt) <= new Date();
                return <div key={key.id} className="flex items-center justify-between rounded-md border p-3">
                    <div><div className="font-medium">{key.name} {expired && <span className="ml-1 rounded bg-destructive/15 px-1.5 py-0.5 text-xs text-destructive">Expired</span>}</div><div className="text-xs text-muted-foreground">Created: {new Date(key.createdAt).toLocaleString()}{key.expiresAt ? ` | Expires: ${new Date(key.expiresAt).toLocaleString()}` : ''}</div></div>
                    <Button variant="destructive" size="sm" onClick={() => remove(key.id)}>Delete</Button>
                </div>;
            })}
            {apiKeys.length === 0 && <p className="text-sm text-muted-foreground">No API keys for this user yet.</p>}
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => closeDialog()}>Close</Button><Button onClick={create}>Create REST API Key</Button></div>
    </div>;
}
