'use client';

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { useDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { Bot, ExternalLink, Files, Logs, Play, Square, Terminal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startSandbox, stopSandbox } from "./actions";
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
import { AgentDomain } from "@prisma/client";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import AgentAccessDialogContent from "./agent-access-dialog";

interface SandboxInfo {
    name: string;
    status: DeploymentStatus;
    statusText: string;
    createdAt: string | null;
}

const SSE_RETRY_BASE_DELAY_MS = 1_000;
const SSE_RETRY_MAX_DELAY_MS = 30_000;

export default function AgentSandboxesCard({
    agentId,
    readonly,
    namespace,
    agentDomains,
}: {
    agentId: string;
    readonly: boolean;
    namespace: string;
    agentDomains: AgentDomain[];
}) {
    const { openDialog } = useDialog();
    const [sandboxes, setSandboxes] = useState<SandboxInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // SSE stream for live sandbox updates
    useEffect(() => {
        const controller = new AbortController();
        let stopped = false;
        let reader: ReadableStreamDefaultReader<string> | null = null;
        let retryTimeout: ReturnType<typeof setTimeout> | null = null;
        let resolveRetry: (() => void) | null = null;
        let retryAttempt = 0;

        const waitForRetry = (delayMs: number) => new Promise<void>(resolve => {
            resolveRetry = resolve;
            retryTimeout = setTimeout(() => {
                retryTimeout = null;
                resolveRetry = null;
                resolve();
            }, delayMs);
        });

        const connectSse = async () => {
            while (!stopped) {
                try {
                    const response = await fetch('/api/agent-sandboxes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/event-stream' },
                        body: JSON.stringify({ agentId }),
                        signal: controller.signal,
                    });

                    if (!response.ok || !response.body) {
                        throw new Error(`SSE request failed with status ${response.status}`);
                    }

                    setIsConnected(true);
                    reader = response.body
                        .pipeThrough(new TextDecoderStream())
                        .getReader();

                    let buffer = '';
                    while (!stopped) {
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
                                            setSandboxes(ListUtils.dedupByName(msg.data, 'name'));
                                        } else if (msg.type === 'ADDED' && msg.sandbox) {
                                            setSandboxes(prev => {
                                                if (prev.some(i => i.name === msg.sandbox.name)) return prev;
                                                return [...prev, msg.sandbox];
                                            });
                                        } else if (msg.type === 'MODIFIED' && msg.sandbox) {
                                            setSandboxes(prev => prev.map(i =>
                                                i.name === msg.sandbox.name ? msg.sandbox : i
                                            ));
                                        } else if (msg.type === 'DELETED' && msg.sandbox?.name) {
                                            setSandboxes(prev => prev.filter(i =>
                                                i.name !== msg.sandbox.name
                                            ));
                                        }
                                    } catch {
                                        // Ignore malformed SSE payloads and keep the stream alive.
                                    }
                                }
                            }
                        }
                    }
                } catch (err: any) {
                    if (err?.name !== 'AbortError' && !stopped) {
                        console.error('Agent sandboxes SSE error:', err);
                    }
                } finally {
                    reader = null;
                    if (!stopped) {
                        setIsConnected(false);
                    }
                }

                if (stopped) break;

                const exponentialDelay = Math.min(
                    SSE_RETRY_BASE_DELAY_MS * 2 ** retryAttempt,
                    SSE_RETRY_MAX_DELAY_MS,
                );
                const jitteredDelay = exponentialDelay * (0.8 + Math.random() * 0.4);
                retryAttempt += 1;
                await waitForRetry(jitteredDelay);
            }
        };

        void connectSse();

        return () => {
            stopped = true;
            controller.abort();
            if (retryTimeout) {
                clearTimeout(retryTimeout);
                retryTimeout = null;
            }
            resolveRetry?.();
            void reader?.cancel();
        };
    }, [agentId]);

    const handleStartSandbox = async () => {
        setLoading(true);
        try {
            await Toast.fromAction(
                () => startSandbox(agentId),
                'Sandbox started',
                'Starting sandbox...',
            );
        } finally {
            setLoading(false);
            // SSE will push updated list automatically
        }
    };

    const handleStopSandbox = async (sandboxName: string) => {
        try {
            await Toast.fromAction(
                () => stopSandbox(agentId, sandboxName),
                'Sandbox stopped',
                'Stopping sandbox...',
            );
            // SSE will push updated list automatically
        } finally {
            // nothing to fetch — SSE handles it
        }
    };

    const handleOpenTerminal = async () => {
        // Terminal opening is delegated to parent component via callback
        // For now, this is a placeholder — terminal per sandbox needs pod discovery
    };

    const handleOpenLogs = (sandboxName: string) => {
        openDialog(<LogsDialogContent namespace={namespace} podName={sandboxName} />, { maxWidth: '1300px' });
    };

    const handleOpenAgentAccess = (sandboxName: string, view: 'agent' | 'files', domainId: string) => {
        if (agentDomains.length === 0) {
            toast.error('Configure an Agent access domain first.');
            return;
        }

        openDialog(
            <AgentAccessDialogContent
                agentId={agentId}
                sandboxName={sandboxName}
                view={view}
                domainId={domainId}
            />,
            { maxWidth: '440px' }
        );
    };

    const renderAccessButton = (sandboxName: string, view: 'agent' | 'files') => {
        const icon = view === 'agent'
            ? <ExternalLink className="h-4 w-4" />
            : <Files className="h-4 w-4" />;
        const disabled = agentDomains.length === 0;

        if (agentDomains.length <= 1) {
            return (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={disabled}
                    onClick={() => {
                        const domainId = agentDomains[0]?.id;
                        if (!domainId) {
                            toast.error('Configure an Agent access domain first.');
                            return;
                        }
                        handleOpenAgentAccess(sandboxName, view, domainId);
                    }}
                >
                    {icon}
                </Button>
            );
        }

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                    >
                        {icon}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {agentDomains.map((domain) => (
                        <DropdownMenuItem key={domain.id} onClick={() => handleOpenAgentAccess(sandboxName, view, domain.id)}>
                            {domain.hostname}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Agent Sandboxes</CardTitle>
                    <CardDescription>
                        Start and manage agent sandboxes for this agent.
                        {sandboxes.length > 0 && ` ${sandboxes.length} sandbox${sandboxes.length !== 1 ? 's' : ''} running.`}
                    </CardDescription>
                </div>
                {!readonly && (
                    <Button
                        onClick={handleStartSandbox}
                        disabled={loading}
                        variant="secondary"
                        size="sm"
                    >
                        <Play className="h-4 w-4 mr-1" />
                        Start New Sandbox
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {!isConnected ? <FullLoadingSpinner /> : <>
                    {sandboxes.length === 0 ? (
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Bot />
                                </EmptyMedia>
                                <EmptyTitle>No running Sandboxes</EmptyTitle>
                                <EmptyDescription>
                                    There are currently no running sandboxes for this agent. Click &quot;Start New Sandbox&quot; to create one.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent className="flex-row justify-center gap-2">
                                <Button
                                    onClick={handleStartSandbox}
                                    disabled={loading || readonly}
                                    size="sm"
                                >
                                    <Play className="h-4 w-4 mr-1" />
                                    Start New Sandbox
                                </Button>
                            </EmptyContent>
                        </Empty>
                    ) : (
                        <SimpleDataTable
                            columns={[
                                ['name', 'Sandbox Name', true, (item: SandboxInfo) => (
                                    <span className="font-mono text-sm">{item.name}</span>
                                )],
                                ['status', 'Status', true, (item: SandboxInfo) => (
                                    <DeploymentStatusBadge >{item.status}</DeploymentStatusBadge>
                                )],
                                ['createdAt', 'Created', true, (item: SandboxInfo) =>
                                    item.createdAt
                                        ? new Date(item.createdAt).toLocaleString()
                                        : '—'
                                ],
                            ]}
                            data={sandboxes}
                            actionCol={(item: SandboxInfo) => (
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
                                            <>
                                                <Tooltip delayDuration={300}>
                                                    <TooltipTrigger asChild>
                                                        {renderAccessButton(item.name, 'agent')}
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Open Agent UI</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Tooltip delayDuration={300}>
                                                    <TooltipTrigger asChild>
                                                        {renderAccessButton(item.name, 'files')}
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Open Files</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Tooltip delayDuration={300}>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleOpenTerminal()}
                                                        >
                                                            <Terminal className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Open Terminal</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </>
                                        )}
                                        {!readonly && (
                                            <Tooltip delayDuration={300}>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500 hover:text-red-700"
                                                        onClick={() => handleStopSandbox(item.name)}
                                                    >
                                                        <Square className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Stop Sandbox</p>
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
