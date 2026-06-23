'use client';

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { Toast } from "@/frontend/utils/toast.utils";
import { Rocket, Trash2, ScrollText, Terminal, Bot, Settings } from "lucide-react";
import { deployAgent, deleteAgent, getAgentPodForTerminal } from "./overview/actions";
import { getInstances } from "./instances/actions";
import AgentSourceCard from "./general/agent-source-card";
import AgentRateLimitsCard from "./general/agent-rate-limits-card";
import AgentSystemPromptCard from "./general/agent-system-prompt-card";
import AgentEnvVarsCard from "./general/agent-env-vars-card";
import AgentLogsCard from "./overview/agent-logs-card";
import { AgentEventsDialog } from "./overview/agent-events-dialog";
import { AgentTerminalDialog } from "./overview/agent-terminal-dialog";
import AgentInstancesCard from "./instances/agent-instances-card";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";

export default function AgentDetailClient({ agent, role }: {
    agent: AgentWithRelationsModel;
    role: RolePermissionEnum | null;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabName = searchParams.get('tabName') || 'instances';
    const readonly = role !== RolePermissionEnum.READWRITE;

    const { openConfirmDialog } = useConfirmDialog();

    const [instanceCount, setInstanceCount] = useState(0);
    const [runningCount, setRunningCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [terminalPodInfo, setTerminalPodInfo] = useState<{ podName: string; containerName: string; namespace: string } | null>(null);
    const [terminalOpen, setTerminalOpen] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const instances = await Actions.run(() => getInstances(agent.id));
            setInstanceCount(instances.length);
            setRunningCount(instances.filter((i: any) => i.status === 'DEPLOYED').length);
        } catch {
            // silently ignore polling errors
        }
    }, [agent.id]);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const openTab = (tab: string) => {
        router.push(`/project/agent/${agent.id}?tabName=${tab}`);
    };

    const handleDeploy = async () => {
        try {
            await Toast.fromAction(
                () => deployAgent(agent.id),
                'Configuration deployed',
                'Deploying configuration...',
            );
        } finally {
            fetchStatus();
        }
    };

    const handleDelete = async () => {
        const confirmed = await openConfirmDialog({
            title: "Delete Agent",
            description: "Are you sure you want to delete this agent? All runtime resources, sandbox definitions, and credentials will be removed. This action cannot be undone.",
            okButton: "Delete Agent",
        });
        if (confirmed) {
            await Toast.fromAction(
                () => deleteAgent(agent.id),
                'Agent deleted successfully.',
                'Deleting Agent...',
            );
            router.push(`/project/${agent.projectId}`);
        }
    };

    const handleOpenTerminal = async () => {
        setLoading(true);
        try {
            const result = await getAgentPodForTerminal(agent.id);
            if (result.status === 'success' && result.data) {
                setTerminalPodInfo(result.data);
                setTerminalOpen(true);
            } else {
                await Toast.fromAction(
                    async () => { throw new Error(result.message || 'No agent pod running.'); },
                    '',
                    '',
                );
            }
        } catch {
            // error shown by toast
        } finally {
            setLoading(false);
        }
    };

    const hasInstances = instanceCount > 0;

    return (
        <>
            <Tabs value={tabName} onValueChange={openTab}>
                <TabsList>
                    <TabsTrigger value="instances"><Bot className="mr-2 h-4 w-4" /> Instances</TabsTrigger>
                    <TabsTrigger value="general"><Settings className="mr-2 h-4 w-4" />Configuration</TabsTrigger>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="pt-4">
                    <div className="space-y-6">
                        <AgentSourceCard agent={agent} readonly={readonly} />
                        <AgentRateLimitsCard agent={agent} readonly={readonly} />
                        <AgentSystemPromptCard agent={agent} readonly={readonly} />
                        <AgentEnvVarsCard agent={agent} readonly={readonly} />
                    </div>
                </TabsContent>

                <TabsContent value="instances" className="pt-4">
                    <AgentInstancesCard agentId={agent.id} readonly={readonly} namespace={agent.projectId} />
                </TabsContent>

                <TabsContent value="overview" className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="space-y-2">
                                    <div>
                                        <dt className="text-sm text-muted-foreground">ID</dt>
                                        <dd className="text-sm font-mono">{agent.id}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">LLM Gateway</dt>
                                        <dd className="text-sm">{agent.llmGateway.name}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">Model Alias</dt>
                                        <dd className="text-sm font-mono">{agent.modelAlias}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">Created</dt>
                                        <dd className="text-sm">{new Date(agent.createdAt).toLocaleString()}</dd>
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Agent Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hasInstances ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                                            {hasInstances ? `${runningCount}/${instanceCount} running` : 'No instances'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <AgentEventsDialog agentId={agent.id}>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                            >
                                                <ScrollText className="h-4 w-4 mr-1" />
                                                Events
                                            </Button>
                                        </AgentEventsDialog>
                                        {hasInstances && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={handleOpenTerminal}
                                                disabled={loading}
                                            >
                                                <Terminal className="h-4 w-4 mr-1" />
                                                Terminal
                                            </Button>
                                        )}
                                    </div>
                                    {!readonly && (
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleDeploy}
                                                disabled={loading}
                                                variant="secondary"
                                                size="sm"
                                            >
                                                <Rocket className="h-4 w-4 mr-1" />
                                                Deploy
                                            </Button>
                                            <Button
                                                onClick={handleDelete}
                                                disabled={loading}
                                                variant="destructive"
                                                size="sm"
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                Delete
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="mt-6">
                        <AgentLogsCard agentId={agent.id} projectId={agent.projectId} />
                    </div>
                </TabsContent>
            </Tabs>
            {terminalPodInfo && (
                <AgentTerminalDialog
                    open={terminalOpen}
                    onOpenChange={setTerminalOpen}
                    podName={terminalPodInfo.podName}
                    containerName={terminalPodInfo.containerName}
                    namespace={terminalPodInfo.namespace}
                />
            )}
        </>
    );
}
