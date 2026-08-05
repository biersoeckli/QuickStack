'use client';

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import TerminalStreamed from "../../../app/[appId]/overview/terminal-streamed";

export function AgentTerminalDialog({
    open,
    onOpenChange,
    podName,
    containerName,
    namespace,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    podName: string;
    containerName: string;
    namespace: string;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1300px]">
                <DialogHeader>
                    <DialogTitle>Agent Terminal</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <TerminalStreamed
                        terminalInfo={{ namespace, podName, containerName }}
                        terminalTypes={['opencode']}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
