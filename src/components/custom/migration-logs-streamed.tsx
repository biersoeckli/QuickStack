'use client';

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Source_Code_Pro } from "next/font/google";
import { cn } from "@/frontend/utils/utils";

const sourceCodePro = Source_Code_Pro({
    subsets: ["latin"],
    variable: "--font-sans",
});

export default function MigrationLogsStreamed({
    migrationJobName,
    migrationJobNamespace,
}: {
    migrationJobName: string;
    migrationJobNamespace: string;
}) {
    const [isConnected, setIsConnected] = useState(false);
    const [logs, setLogs] = useState<string>('');
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const initializeConnection = async (controller: AbortController) => {
        setLogs('Loading...');
        const signal = controller.signal;

        const apiResponse = await fetch('/api/pod-logs', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ migrationJobName, migrationJobNamespace }),
            signal,
        });

        if (!apiResponse.ok) {
            setLogs(`Failed to connect to log stream (${apiResponse.status}).`);
            return;
        }
        if (!apiResponse.body) return;
        setIsConnected(true);

        const reader = apiResponse.body
            .pipeThrough(new TextDecoderStream())
            .getReader();

        setLogs('');
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                setIsConnected(false);
                break;
            }
            if (value) {
                setLogs((prev) => prev + value);
            }
        }
    };

    useEffect(() => {
        if (!migrationJobName || !migrationJobNamespace) return;
        const controller = new AbortController();
        initializeConnection(controller);
        return () => {
            setLogs('');
            controller.abort();
        };
    }, [migrationJobName, migrationJobNamespace]);

    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="space-y-4">
            <Textarea
                ref={textAreaRef}
                value={logs}
                readOnly
                className={cn("h-[400px] bg-slate-900 text-white", sourceCodePro.className)}
            />
            <div className="w-fit">
                <HoverCard>
                    <HoverCardTrigger>
                        {isConnected
                            ? <div className="w-3 h-3 rounded-full bg-green-500" />
                            : <div className="w-3 h-3 rounded-full bg-slate-500" />}
                    </HoverCardTrigger>
                    <HoverCardContent className="text-sm">
                        {isConnected ? 'Connected to log stream' : 'Disconnected from log stream'}
                    </HoverCardContent>
                </HoverCard>
            </div>
        </div>
    );
}
