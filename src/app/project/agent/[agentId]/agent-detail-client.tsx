'use client';

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { Toast } from "@/frontend/utils/toast.utils";
import { Bot, Settings } from "lucide-react";
import { getAgentPodForTerminal } from "./overview/actions";
import AgentSourceCard from "./general/agent-source-card";
import AgentRateLimitsCard from "./general/agent-rate-limits-card";
import AgentSystemPromptCard from "./general/agent-system-prompt-card";
import AgentEnvVarsCard from "./general/agent-env-vars-card";
import AgentStatusBar from "./general/agent-status-bar";
import { AgentTerminalDialog } from "./overview/agent-terminal-dialog";
import AgentInstancesCard from "./instances/agent-instances-card";
import { AgentSanboxTemplateInfo } from "@/shared/model/agent-sandbox-template-info.model";

export default function AgentDetailClient({ agent, role, templateInfo }: {
    agent: AgentWithRelationsModel;
    templateInfo: AgentSanboxTemplateInfo;
    role: RolePermissionEnum | null;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabName = searchParams.get('tabName') || 'instances';
    const readonly = role !== RolePermissionEnum.READWRITE;

    const openTab = (tab: string) => {
        router.push(`/project/agent/${agent.id}?tabName=${tab}`);
    };

    return (
        <>
            <Tabs value={tabName} onValueChange={openTab}>
                <TabsList>
                    <TabsTrigger value="instances"><Bot className="mr-2 h-4 w-4" /> Instances</TabsTrigger>
                    <TabsTrigger value="general"><Settings className="mr-2 h-4 w-4" />Configuration</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="pt-4">
                    <div className="space-y-4">
                        <AgentStatusBar agent={agent} readonly={readonly} templateInfo={templateInfo} />
                        <AgentSourceCard agent={agent} readonly={readonly} />
                        <AgentRateLimitsCard agent={agent} readonly={readonly} />
                        <AgentSystemPromptCard agent={agent} readonly={readonly} />
                        <AgentEnvVarsCard agent={agent} readonly={readonly} />
                    </div>
                </TabsContent>

                <TabsContent value="instances" className="pt-4">
                    <AgentInstancesCard agentId={agent.id} readonly={readonly} namespace={agent.projectId} />
                </TabsContent>
            </Tabs>
        </>
    );
}
