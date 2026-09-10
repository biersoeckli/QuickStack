'use client';

import React from "react";
import { Textarea } from "@/components/ui/textarea";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Source_Code_Pro } from "next/font/google";
import { cn } from "@/frontend/utils/utils";
import { useLogStream } from "@/frontend/hooks/use-log-stream";
import { Constants } from "@/shared/utils/constants";

const sourceCodePro = Source_Code_Pro({
    subsets: ["latin"],
    variable: "--font-sans",
});


export default function BuildLogsStreamed({
    deploymentId,
    fullHeight = false,
    maxLines = Constants.DEFAULT_MAX_LOG_LINES,
}: {
    deploymentId?: string;
    fullHeight?: boolean;
    maxLines?: number;
}) {
    const { logs, isConnected, textAreaRef } = useLogStream(
        '/api/build-logs',
        JSON.stringify({ deploymentId }),
        Boolean(deploymentId),
        maxLines,
    );

    return <>
        <div className="space-y-4">
            <Textarea ref={textAreaRef} value={logs} readOnly className={cn(
                (fullHeight ? "h-[80vh]" : "h-[400px]"),
                " bg-slate-900 text-white",
                sourceCodePro.className)} />
            <div className="w-fit">
                <HoverCard>
                    <HoverCardTrigger>
                        {isConnected ? <div className="w-3 h-3 rounded-full bg-green-500"></div> : <div className="w-3 h-3 rounded-full bg-slate-500"></div>}
                    </HoverCardTrigger>
                    <HoverCardContent className="text-sm">
                        {isConnected ? 'Connected to Logstream' : 'Disconnected from Logstream'}
                    </HoverCardContent>
                </HoverCard>
            </div>
        </div>
    </>;
}
