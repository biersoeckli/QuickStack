'use client';

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { Toast } from "@/frontend/utils/toast.utils";
import { Play, Rocket, Square } from "lucide-react";
import { getAgentStatus, startAgent, stopAgent, deployAgent } from "./overview/actions";
import AgentSourceCard from "./general/agent-source-card";
import AgentRateLimitsCard from "./general/agent-rate-limits-card";
import AgentSystemPromptCard from "./general/agent-system-prompt-card";
import AgentEnvVarsCard from "./general/agent-env-vars-card";

function getStatusColor(status: DeploymentStatus): string {
    switch (status) {
        case 'DEPLOYED': return 'text-green-600 bg-green-50';
        case 'DEPLOYING': return 'text-yellow-600 bg-yellow-50';
        case 'ERROR': return 'text-red-600 bg-red-50';
        case 'SHUTDOWN': return 'text-gray-500 bg-gray-100';
        default: return 'text-gray-500 bg-gray-100';
    }
}

export default function AgentDetailClient({ agent, role }: {
    agent: AgentWithRelationsModel;
    role: RolePermissionEnum | null;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabName = searchParams.get('tabName') || 'general';
    const readonly = role !== RolePermissionEnum.READWRITE;

    const [status, setStatus] = useState<DeploymentStatus>('SHUTDOWN');
    const [statusText, setStatusText] = useState('Shut Down');
    const [loading, setLoading] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const result = await getAgentStatus(agent.id);
            if (result.status === 'success' && result.data) {
                setStatus(result.data.status);
                setStatusText(result.data.statusText);
            }
        } catch {
            // Keep current status on error
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

    const handleStart = async () => {
        setLoading(true);
        await Toast.fromAction(
            () => startAgent(agent.id),
            'Agent started',
            'Starting Agent...',
        );
        setLoading(false);
        fetchStatus();
    };

    const handleStop = async () => {
        setLoading(true);
        await Toast.fromAction(
            () => stopAgent(agent.id),
            'Agent stopped',
            'Stopping Agent...',
        );
        setLoading(false);
        fetchStatus();
    };

    const handleDeploy = async () => {
        setLoading(true);
        await Toast.fromAction(
            () => deployAgent(agent.id),
            'Configuration deployed',
            'Deploying configuration...',
        );
        setLoading(false);
    };

    const isRunning = status === 'DEPLOYED' || status === 'DEPLOYING';
    const isStopped = status === 'SHUTDOWN' || status === 'ERROR';

    return (
        <Tabs value={tabName} onValueChange={openTab}>
            <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
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
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                                        {statusText}
                                    </span>
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
                                            onClick={handleStart}
                                            disabled={isRunning || loading}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            <Play className="h-4 w-4 mr-1" />
                                            Start
                                        </Button>
                                        <Button
                                            onClick={handleStop}
                                            disabled={isStopped || loading}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            <Square className="h-4 w-4 mr-1" />
                                            Stop
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    );
}
