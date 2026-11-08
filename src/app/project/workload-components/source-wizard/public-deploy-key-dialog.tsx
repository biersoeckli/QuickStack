'use client';

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

export function PublicDeployKeyDialog({ publicKey }: { publicKey: string }) {
    const { closeDialog } = useDialogContext();

    const copyPublicKey = () => {
        navigator.clipboard.writeText(publicKey);
        toast.success('Copied to clipboard.');
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>Public Deploy Key</DialogTitle>
                <DialogDescription>Add this public key as a deploy key in your Git provider.</DialogDescription>
            </DialogHeader>
            <Textarea readOnly value={publicKey} className="min-h-32 font-mono text-xs" />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={copyPublicKey}>
                    <ClipboardCopy className="h-4 w-4" />
                    Copy
                </Button>
                <Button type="button" onClick={() => closeDialog(true)}>Close</Button>
            </DialogFooter>
        </>
    );
}
