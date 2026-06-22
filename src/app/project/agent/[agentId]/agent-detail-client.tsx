'use client';

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import AgentConfigForm from "./general/agent-config-form";

export default function AgentDetailClient({ agent, role }: {
    agent: AgentWithRelationsModel;
    role: RolePermissionEnum | null;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabName = searchParams.get('tabName') || 'general';
    const readonly = role !== RolePermissionEnum.READWRITE;

    const openTab = (tab: string) => {
        router.push(`/project/agent/${agent.id}?tabName=${tab}`);
    };

    return (
        <Tabs value={tabName} onValueChange={openTab}>
            <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="pt-4">
                <AgentConfigForm agent={agent} readonly={readonly} />
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
                    <Card className="border-dashed">
                        <CardHeader>
                            <CardTitle>Agent Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Agent runtime controls and status will be available in a future update.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    );
}
