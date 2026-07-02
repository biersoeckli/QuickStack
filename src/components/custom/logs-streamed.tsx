import { useCallback, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import React from "react";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Source_Code_Pro } from "next/font/google";
import { cn } from "@/frontend/utils/utils";

const sourceCodePro = Source_Code_Pro({
    subsets: ["latin"],
    variable: "--font-sans",
});

export default function LogsStreamed({
    namespace,
    podName,
    buildJobName,
    fullHeight = false,
    linesCount = 100,
}: {
    namespace?: string;
    podName?: string;
    buildJobName?: string;
    fullHeight?: boolean;
    linesCount?: number;
}) {
    const [isConnected, setIsConnected] = useState(false);
    const [logs, setLogs] = useState<string>('');
    const textAreaRef = useRef<HTMLTextAreaElement>(null);



    const initializeConnection = useCallback(async (controller: AbortController) => {
        // Initiate the first call to connect to SSE API

        setLogs('Loading...');

        const signal = controller.signal;
        const apiResponse = await fetch('/api/pod-logs', {
            method: "POST",
            headers: {
                "Content-Type": "text/event-stream",
            },
            body: JSON.stringify({ namespace, podName, buildJobName, linesCount }),
            signal: signal,
        });

        if (!apiResponse.ok) return;
        if (!apiResponse.body) return;
        setIsConnected(true);

        // To decode incoming data as a string
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
                setLogs((prevLogs) => prevLogs + value);
            }
        }
    }, [buildJobName, linesCount, namespace, podName])

    useEffect(() => {
        if (!buildJobName && (!namespace || !podName)) {
            return;
        }
        const controller = new AbortController();
        initializeConnection(controller);

        return () => {
            console.log('Disconnecting from logs');
            setLogs('');
            controller.abort();
        };
    }, [namespace, podName, buildJobName, linesCount, initializeConnection]);

    useEffect(() => {
        if (textAreaRef.current) {
            // Scroll to the bottom every time logs change
            textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
        }
    }, [logs]);

    return <>
        <div className="space-y-4">
            <Textarea ref={textAreaRef} value={logs} readOnly className={cn(
                (fullHeight ? "h-[80vh]" : "h-[400px]"),
                " bg-slate-900 text-white ",
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
