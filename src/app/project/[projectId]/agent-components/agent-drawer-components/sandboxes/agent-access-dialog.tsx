'use client';


import { useEffect, useState } from "react";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { ExternalLink } from "lucide-react";
import { createAgentAccessUrl } from "./actions";
import { Spinner } from "@/components/ui/spinner";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";

export default function AgentAccessDialogContent({
    agentId,
    sandboxName,
    view,
    domainId,
}: {
    agentId: string;
    sandboxName: string;
    view: 'agent' | 'files';
    domainId: string;
}) {
    const { closeDialog } = useDialogContext();
    const [url, setUrl] = useState<string>();
    const [error, setError] = useState<string>();
    const viewLabel = view === 'agent' ? 'Agent UI' : 'File Browser';

    useEffect(() => {
        let active = true;

        const createUrl = async () => {
            setUrl(undefined);
            setError(undefined);

            try {
                const result = await Actions.run(() => createAgentAccessUrl(agentId, sandboxName, view, domainId));
                if (active) {
                    setUrl(result.url);
                }
            } catch (err: any) {
                if (active) {
                    setError(err?.message || 'Could not open Agent access.');
                }
            }
        };

        createUrl();

        return () => {
            active = false;
        };
    }, [agentId, sandboxName, domainId, view]);

    return (
        <>
            <DialogHeader>
                <DialogTitle>Open {viewLabel}</DialogTitle>
            </DialogHeader>

            <div className="flex  items-center justify-center rounded-md border bg-muted/30 p-4">
                {!url && !error && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner />
                        Generating access link...
                    </div>
                )}
                {url && (
                    <p className="text-sm text-muted-foreground">
                        The link is ready. Open the {viewLabel} in a new tab by clicking the button below. This link is valid for 20 seconds.
                    </p>
                )}
                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
            </div>

            <DialogFooter>
                <Button
                    disabled={!url}
                    onClick={() => {
                        if (!url) return;
                        window.open(url, '_blank', 'noopener,noreferrer');
                        closeDialog();
                    }}
                >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Page
                </Button>
                <Button variant="secondary" onClick={() => closeDialog()}>
                    Close
                </Button>
            </DialogFooter>
        </>
    );
}