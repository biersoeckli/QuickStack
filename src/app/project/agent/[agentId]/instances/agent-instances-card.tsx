'use client';

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { useDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { Bot, Logs, Play, Square, Terminal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startInstance, stopInstance } from "./actions";
import { ListUtils } from "@/shared/utils/list.utils";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";
import { LogsDialogContent } from "@/components/custom/logs-overlay";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"
import DeploymentStatusBadge from "@/app/project/app/[appId]/overview/deployment-status-badge";

interface InstanceInfo {
    name: string;
    status: DeploymentStatus;
    statusText: string;
    createdAt: string | null;
}

export default function AgentInstancesCard({
    agentId,
    readonly,
    namespace,
}: {
    agentId: string;
    readonly: boolean;
    namespace: string;
}) {
    const { openDialog } = useDialog();
    const [instances, setInstances] = useState<InstanceInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);

    // SSE stream for live instance updates
    useEffect(() => {
        const controller = new AbortController();

        const connectSse = async () => {
            try {
                const response = await fetch('/api/agent-instances', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/event-stream' },
                    body: JSON.stringify({ agentId }),
                    signal: controller.signal,
                });

                if (!response.ok || !response.body) return;

                setIsConnected(true);
                const reader = response.body
                    .pipeThrough(new TextDecoderStream())
                    .getReader();
                readerRef.current = reader;

                let buffer = '';
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += value;

                    // Parse SSE frames: split by double newline
                    const frames = buffer.split('\n\n');
                    buffer = frames.pop() || ''; // keep incomplete frame in buffer

                    for (const frame of frames) {
                        const lines = frame.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const msg = JSON.parse(line.slice(6));
                                    if (msg.type === 'FULL' && Array.isArray(msg.data)) {
                                        setInstances(ListUtils.dedupByName(msg.data, 'name'));
                                    } else if (msg.type === 'ADDED' && msg.instance) {
                                        setInstances(prev => {
                                            if (prev.some(i => i.name === msg.instance.name)) return prev;
                                            return [...prev, msg.instance];
                                        });
                                    } else if (msg.type === 'MODIFIED' && msg.instance) {
                                        setInstances(prev => prev.map(i =>
                                            i.name === msg.instance.name ? msg.instance : i
                                        ));
                                    } else if (msg.type === 'DELETED' && msg.instance?.name) {
                                        setInstances(prev => prev.filter(i =>
                                            i.name !== msg.instance.name
                                        ));
                                    }
                                } catch {
                                    // ignore parse errors on partial chunks
                                }
                            }
                        }
                    }
                }
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    console.error('Agent instances SSE error:', err);
                }
            } finally {
                setIsConnected(false);
            }
        };

        connectSse();

        return () => {
            controller.abort();
            readerRef.current?.cancel();
        };
    }, [agentId]);

    const handleStartInstance = async () => {
        setLoading(true);
        try {
            await Toast.fromAction(
                () => startInstance(agentId),
                'Instance started',
                'Starting instance...',
            );
        } finally {
            setLoading(false);
            // SSE will push updated list automatically
        }
    };

    const handleStopInstance = async (claimName: string) => {
        try {
            await Toast.fromAction(
                () => stopInstance(agentId, claimName),
                'Instance stopped',
                'Stopping instance...',
            );
            // SSE will push updated list automatically
        } finally {
            // nothing to fetch — SSE handles it
        }
    };

    const handleOpenTerminal = async (claimName: string) => {
        // Terminal opening is delegated to parent component via callback
        // For now, this is a placeholder — terminal per instance needs pod discovery
    };

    const handleOpenLogs = (claimName: string) => {
        openDialog(<LogsDialogContent namespace={namespace} podName={claimName} />, { maxWidth: '1300px' });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Agent Instances</CardTitle>
                    <CardDescription>
                        Start and manage agent instances for this agent.
                        {instances.length > 0 && ` ${instances.length} instance${instances.length !== 1 ? 's' : ''} running.`}
                    </CardDescription>
                </div>
                {!readonly && (
                    <Button
                        onClick={handleStartInstance}
                        disabled={loading}
                        variant="secondary"
                        size="sm"
                    >
                        <Play className="h-4 w-4 mr-1" />
                        Start New Instance
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {!isConnected ? <FullLoadingSpinner /> : <>
                    {instances.length === 0 ? (
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Bot />
                                </EmptyMedia>
                                <EmptyTitle>No running Instances</EmptyTitle>
                                <EmptyDescription>
                                    There are currently no running instances for this agent. Click "Start New Instance" to create one.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent className="flex-row justify-center gap-2">
                                <Button
                                    onClick={handleStartInstance}
                                    disabled={loading || readonly}
                                    size="sm"
                                >
                                    <Play className="h-4 w-4 mr-1" />
                                    Start New Instance
                                </Button>
                            </EmptyContent>
                        </Empty>
                    ) : (
                        <SimpleDataTable
                            columns={[
                                ['name', 'Instance Name', true, (item: InstanceInfo) => (
                                    <span className="font-mono text-sm">{item.name}</span>
                                )],
                                ['status', 'Status', true, (item: InstanceInfo) => (
                                    <DeploymentStatusBadge >{item.status}</DeploymentStatusBadge>
                                )],
                                ['createdAt', 'Created', true, (item: InstanceInfo) =>
                                    item.createdAt
                                        ? new Date(item.createdAt).toLocaleString()
                                        : '—'
                                ],
                            ]}
                            data={instances}
                            actionCol={(item: InstanceInfo) => (
                                <TooltipProvider>
                                    <div className="flex gap-1">
                                        <Tooltip delayDuration={300}>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleOpenLogs(item.name)}
                                                >
                                                    <Logs className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>View Logs</p>
                                            </TooltipContent>
                                        </Tooltip>
                                        {item.status === 'DEPLOYED' && (
                                            <Tooltip delayDuration={300}>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleOpenTerminal(item.name)}
                                                    >
                                                        <Terminal className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Open Terminal</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {!readonly && (
                                            <Tooltip delayDuration={300}>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500 hover:text-red-700"
                                                        onClick={() => handleStopInstance(item.name)}
                                                    >
                                                        <Square className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Stop Instance</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </TooltipProvider>
                            )}
                            hideSearchBar
                        />
                    )}
                </>}
            </CardContent>
        </Card>
    );
}
