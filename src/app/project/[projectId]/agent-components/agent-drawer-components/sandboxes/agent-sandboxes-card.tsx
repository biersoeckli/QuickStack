'use client';

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog, useDialog, useInputDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { Bot, ChevronDown, ExternalLink, Files, Filter, Logs, Pause, Play, PlayIcon, Search, Square, Terminal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startSandbox, stopSandbox, suspendSandbox, resumeSandbox, deleteAgentTag } from "./actions";
import { ListUtils } from "@/shared/utils/list.utils";
import { StreamUtils } from "@/shared/utils/stream.utils";
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
import type { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import AgentAccessDialogContent from "./agent-access-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DrawerCard, DrawerCardDescription, DrawerCardHeader, DrawerCardTitle } from "@/components/custom/drawer-card";
import { Input } from "@/components/ui/input";
import { SplitButton } from "@/components/custom/split-button";

interface SandboxInfo {
    name: string;
    status: DeploymentStatus;
    statusText: string;
    createdAt: string | null;
    customTag?: string;
}

const SSE_RETRY_BASE_DELAY_MS = 1_000;
const SSE_RETRY_MAX_DELAY_MS = 30_000;
const SANDBOX_STATUSES: DeploymentStatus[] = ['DEPLOYED', 'DEPLOYING', 'BUILDING', 'PENDING', 'SUSPENDED', 'SHUTTING_DOWN', 'SHUTDOWN', 'ERROR', 'UNKNOWN'];

const SANDBOX_STATUS_LABELS: Record<DeploymentStatus, string> = {
    DEPLOYED: 'Deployed',
    DEPLOYING: 'Deploying',
    BUILDING: 'Building',
    PENDING: 'Pending',
    SUSPENDED: 'Suspended',
    SHUTTING_DOWN: 'Stopping',
    SHUTDOWN: 'Shutdown',
    ERROR: 'Error',
    UNKNOWN: 'Unknown',
};

export default function AgentSandboxesCard({
    agent,
    readonly,
}: {
    agent: AgentExtendedModel;
    readonly: boolean;
}) {
    const { id: agentId, projectId: namespace, agentDomains, deployFileBrowser } = agent;
    const { openDialog } = useDialog();
    const { openInputDialog } = useInputDialog();
    const { openConfirmDialog } = useConfirmDialog();
    const [sandboxes, setSandboxes] = useState<SandboxInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [expandedSandboxNames, setExpandedSandboxNames] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<DeploymentStatus[]>([]);

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

                        const parsed = StreamUtils.parseSseFrames(buffer, value);
                        buffer = parsed.buffer;

                        for (const frame of parsed.frames) {
                            try {
                                const msg = JSON.parse(frame);
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

    const handleStartSandboxWithCustomTag = async () => {
        const customTag = await openInputDialog({
            title: 'Start sandbox with custom tag',
            description: 'The tag identifies this sandbox and must be unique for this Sandbox Instance (1–63 characters).',
            fieldName: 'Custom tag',
            okButton: 'Start sandbox',
        });
        if (!customTag) {
            return;
        }

        setLoading(true);
        try {
            await Toast.fromAction(
                () => startSandbox(agentId, customTag),
                'Sandbox started',
                'Starting sandbox...',
            );
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTagData = async () => {
        const customTag = await openInputDialog({
            title: 'Delete Custom Tag data',
            description: 'Deletes all stored data of this Custom Tag. The tag must not have a running sandbox. 1–63 characters.',
            fieldName: 'Custom tag',
            okButton: 'Continue',
        });
        if (!customTag) {
            return;
        }

        const confirmed = await openConfirmDialog({
            title: 'Delete Custom Tag data',
            description: `All stored data of Custom Tag "${customTag}" will be deleted permanently. This cannot be undone.`,
            okButton: 'Delete data',
        });
        if (!confirmed) {
            return;
        }

        await Toast.fromAction(
            () => deleteAgentTag(agentId, customTag),
            'Custom Tag data deleted',
            'Deleting Custom Tag data...',
        );
    };

    const renderStartSandboxActions = () => (
        <SplitButton
            onClick={handleStartSandbox}
            disabled={loading}
            size="sm"
            containerClassName="shrink-0"
            dropdownLabel="More sandbox start options"
            dropdownContent={<DropdownMenuGroup>
                <DropdownMenuItem onClick={() => void handleStartSandboxWithCustomTag()}>
                    Start with custom tag
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDeleteTagData()}>
                    Delete custom tag data
                </DropdownMenuItem>
            </DropdownMenuGroup>}
        >
            <Play data-icon="inline-start" />
            Start sandbox
        </SplitButton>
    );

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

    const handleSuspendSandbox = async (sandboxName: string) => {
        await Toast.fromAction(
            () => suspendSandbox(agentId, sandboxName),
            'Sandbox suspended',
            'Suspending sandbox...',
        );
    };

    const handleResumeSandbox = async (sandboxName: string) => {
        await Toast.fromAction(
            () => resumeSandbox(agentId, sandboxName),
            'Sandbox resumed',
            'Resuming sandbox...',
        );
    };

    const handleOpenTerminal = async () => {
        // Terminal opening is delegated to parent component via callback
        // For now, this is a placeholder — terminal per sandbox needs pod discovery
    };

    const toggleSandboxExpanded = (sandboxName: string, open: boolean) => {
        setExpandedSandboxNames(current => open
            ? [...new Set([...current, sandboxName])]
            : current.filter(name => name !== sandboxName),
        );
    };

    const toggleStatusFilter = (status: DeploymentStatus, checked: boolean) => {
        setStatusFilter(current => checked
            ? [...current, status]
            : current.filter(value => value !== status),
        );
    };

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const filteredSandboxes = sandboxes.filter(sandbox => {
        const matchesSearch = normalizedSearchQuery.length === 0
            || sandbox.name.toLowerCase().includes(normalizedSearchQuery)
            || sandbox.customTag?.toLowerCase().includes(normalizedSearchQuery);
        const matchesStatus = statusFilter.length === 0 || statusFilter.includes(sandbox.status);

        return matchesSearch && matchesStatus;
    });

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

    const renderAccessButton = (sandboxName: string, view: 'agent' | 'files', showLabel = false) => {
        const icon = view === 'agent'
            ? <ExternalLink className="h-4 w-4" />
            : <Files className="h-4 w-4" />;
        const label = view === 'agent' ? 'Open agent' : 'Files';
        const disabled = agentDomains.length === 0;

        if (agentDomains.length <= 1) {
            return (
                <Button
                    variant="ghost"
                    size={showLabel ? 'sm' : 'icon'}
                    className={showLabel ? undefined : 'h-8 w-8'}
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
                    {showLabel && <span className="ml-1.5">{label}</span>}
                </Button>
            );
        }

        return (
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button
                    variant={showLabel ? 'outline' : 'ghost'}
                    size={showLabel ? 'sm' : 'icon'}
                    className={showLabel ? undefined : 'h-8 w-8'}
                >
                    {icon}
                    {showLabel && <span className="ml-1.5">{label}</span>}
                </Button>} />
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
        <DrawerCard className="gap-4 px-1">
            <div className="flex items-start justify-between gap-4">
                <DrawerCardHeader>
                    <DrawerCardTitle>Sandboxes</DrawerCardTitle>
                    <DrawerCardDescription>
                        {sandboxes.length === 0
                            ? 'Start a sandbox to open an agent workspace.'
                            : `${sandboxes.length} sandbox${sandboxes.length === 1 ? '' : 'es'} · ${sandboxes.filter(sandbox => sandbox.status === 'DEPLOYED').length} running`}
                    </DrawerCardDescription>
                </DrawerCardHeader>
                {!readonly && (
                    renderStartSandboxActions()
                )}
            </div>

            {!isConnected ? <FullLoadingSpinner /> : (
                sandboxes.length === 0 ? (
                    <Empty className="border rounded-lg py-10">
                        <EmptyHeader>
                            <EmptyMedia variant="icon"><Bot /></EmptyMedia>
                            <EmptyTitle>No sandboxes yet</EmptyTitle>
                            <EmptyDescription>Start a sandbox to create an agent workspace.</EmptyDescription>
                        </EmptyHeader>
                        {!readonly && <EmptyContent className="flex-row justify-center gap-2">
                            {renderStartSandboxActions()}
                        </EmptyContent>}
                    </Empty>
                ) : (
                    <TooltipProvider>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <div className="relative min-w-0 flex-1">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        placeholder="Search name or tag"
                                        className="pl-9"
                                    />
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="shrink-0" />}>
                                        <Filter className="mr-1.5 h-4 w-4" />
                                        Filter{statusFilter.length > 0 && ` (${statusFilter.length})`}
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                        <DropdownMenuLabel>Status</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {SANDBOX_STATUSES.map((status) => (
                                            <DropdownMenuCheckboxItem
                                                key={status}
                                                checked={statusFilter.includes(status)}
                                                onCheckedChange={(checked) => toggleStatusFilter(status, checked)}
                                            >
                                                {SANDBOX_STATUS_LABELS[status]}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {filteredSandboxes.length === 0 && (
                                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                                    No sandboxes match the current search or filter.
                                </div>
                            )}

                            {filteredSandboxes.map((sandbox) => (
                                <Collapsible
                                    key={sandbox.name}
                                    open={expandedSandboxNames.includes(sandbox.name)}
                                    onOpenChange={(open) => toggleSandboxExpanded(sandbox.name, open)}
                                    className="overflow-hidden rounded-lg border bg-card"
                                >
                                    <CollapsibleTrigger render={<button type="button" className="group flex w-full items-start gap-3 p-3 text-left hover:bg-muted/50" />}>
                                        <ChevronDown className="my-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
                                        <div className="min-w-0 flex-1">
                                            <span className="min-w-0 flex-1 truncate">{sandbox.name}</span>
                                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                <span>Tag: <span className="font-mono">{sandbox.customTag ?? '—'}</span></span>
                                                <span aria-hidden>·</span>
                                                <span>Created {sandbox.createdAt ? new Date(sandbox.createdAt).toLocaleString() : '—'}</span>
                                            </div>
                                        </div>
                                        <span className="self-center"><DeploymentStatusBadge>{sandbox.status}</DeploymentStatusBadge></span>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="border-t bg-muted/20 p-3">
                                        <div className="flex flex-wrap gap-2">
                                            {sandbox.status === 'DEPLOYED' && <>
                                                <Tooltip>
                                                    <TooltipTrigger delay={300} render={renderAccessButton(sandbox.name, 'agent', true) as React.ReactElement} />
                                                    <TooltipContent>Open Agent UI</TooltipContent>
                                                </Tooltip>
                                                {deployFileBrowser && <Tooltip>
                                                    <TooltipTrigger delay={300} render={renderAccessButton(sandbox.name, 'files', true) as React.ReactElement} />
                                                    <TooltipContent>Open Files</TooltipContent>
                                                </Tooltip>}
                                                <Button variant="outline" size="sm" onClick={() => handleOpenLogs(sandbox.name)}><Logs className="mr-1.5 h-4 w-4" />Logs</Button>
                                                <Button variant="outline" size="sm" onClick={handleOpenTerminal}><Terminal className="mr-1.5 h-4 w-4" />Terminal</Button>
                                                {!readonly && <Button variant="outline" size="sm" onClick={() => handleSuspendSandbox(sandbox.name)}><Pause className="mr-1.5 h-4 w-4" />Suspend</Button>}
                                            </>}
                                            {sandbox.status === 'SUSPENDED' && !readonly && <Button variant="outline" size="sm" onClick={() => handleResumeSandbox(sandbox.name)}><PlayIcon className="mr-1.5 h-4 w-4" />Resume</Button>}
                                            {!readonly && <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleStopSandbox(sandbox.name)}><Square className="mr-1.5 h-4 w-4" />Delete</Button>}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </div>
                    </TooltipProvider>
                )
            )}
        </DrawerCard>
    );
}
