'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDialog } from "@/frontend/states/zustand.states";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { Toast } from "@/frontend/utils/toast.utils";
import { createRestApiKey, deleteRestApiKey } from "./actions";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { useRouter } from "next/navigation";

export type RestApiKeyMetadata = {
    id: string;
    name: string;
    createdAt: Date;
    expiresAt: Date | null;
};

function OneTimeApiKeyDialog({ rawApiKey }: { rawApiKey: string }) {
    const { closeDialog } = useDialogContext();

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">REST API Key Created</h3>
            <p className="text-sm text-muted-foreground">Copy this key now. It will not be shown again.</p>
            <Input value={rawApiKey} readOnly />
            <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(rawApiKey)}>Copy</Button>
                <Button onClick={() => closeDialog(true)}>Close</Button>
            </div>
        </div>
    );
}

export default function RestApiKeysCard({ initialApiKeys }: { initialApiKeys: RestApiKeyMetadata[] }) {

    const { openDialog } = useDialog();
    const router = useRouter();

    const handleOpenCreateDialog = async () => {
        await openDialog(
            <CreateApiKeyDialog
                onCreated={async (rawApiKey) => {
                    await openDialog(<OneTimeApiKeyDialog rawApiKey={rawApiKey} />, { maxWidth: '640px' });
                    router.refresh();
                }}
            />,
            { maxWidth: '480px' }
        );
    };

    const handleDelete = async (apiKeyId: string) => {
        await Toast.fromAction(() => deleteRestApiKey(apiKeyId));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>REST API Keys</CardTitle>
                <CardDescription>Create and manage API keys for external clients. Keys are shown only once after creation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                {initialApiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <div className="font-medium">{key.name}</div>
                            <div className="text-xs text-muted-foreground">
                                Created: {new Date(key.createdAt).toLocaleString()}{key.expiresAt ? ` | Expires: ${new Date(key.expiresAt).toLocaleString()}` : ''}
                            </div>
                        </div>
                        <Button variant="destructive" onClick={() => handleDelete(key.id)}>Delete</Button>
                    </div>
                ))}
                {initialApiKeys.length === 0 && <p className="text-sm text-muted-foreground">No REST API keys yet.</p>}
            </CardContent>
            <CardFooter>
                <Button onClick={handleOpenCreateDialog}>Create REST API Key</Button>
            </CardFooter>
        </Card>
    );
}
