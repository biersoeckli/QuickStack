'use client';

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { Bot, Hammer, Settings } from "lucide-react";
import AgentSourceCard from "./general/agent-source-card";
import AgentModelConfigurationCard from "./general/agent-model-configuration-card";
import AgentRateLimitsCard from "./general/agent-rate-limits-card";
import AgentContainerConfigCard from "./general/agent-container-config-card";
import AgentSystemPromptCard from "./general/agent-system-prompt-card";
import AgentEnvVarsCard from "./general/agent-env-vars-card";
import AgentStatusBar from "./general/agent-status-bar";
import AgentInstancesCard from "./instances/agent-instances-card";
import { AgentSanboxTemplateInfo } from "@/shared/model/agent-sandbox-template-info.model";
import DomainsCard from "@/components/custom/domains-card";
import AgentVolumesCard from "@/app/project/agent/[agentId]/general/agent-volumes-card";
import FileMountsCard from "@/components/custom/file-mounts-card";
import WorkloadBuildsTable from "@/components/custom/workload-builds-table";

export default function AgentDetailClient({ agent, role, templateInfo }: {
    agent: AgentExtendedModel;
    templateInfo?: AgentSanboxTemplateInfo;
    role: RolePermissionEnum | null;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabName = searchParams.get('tabName') || 'instances';
    const readonly = role !== RolePermissionEnum.READWRITE;
    const hasGitSource = agent.sourceType === 'GIT' || agent.sourceType === 'GIT_SSH';

    const openTab = (tab: string) => {
        router.push(`/project/agent/${agent.id}?tabName=${tab}`);
    };

    return (
        <>
            <Tabs value={tabName} onValueChange={openTab}>
                <TabsList>
                    <TabsTrigger value="instances"><Bot className="mr-2 h-4 w-4" /> Instances</TabsTrigger>
                    {hasGitSource && <TabsTrigger value="builds"><Hammer className="mr-2 h-4 w-4" />Builds</TabsTrigger>}
                    <TabsTrigger value="general"><Settings className="mr-2 h-4 w-4" />Configuration</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="pt-4">
                    <div className="space-y-4">
                        <AgentStatusBar agent={agent} readonly={readonly} templateInfo={templateInfo} />
                        <AgentSourceCard agent={agent} readonly={readonly} />
                        <AgentModelConfigurationCard agent={agent} readonly={readonly} />
                        <AgentContainerConfigCard agent={agent} readonly={readonly} />
                        <AgentSystemPromptCard agent={agent} readonly={readonly} />
                        <AgentRateLimitsCard agent={agent} readonly={readonly} />
                        <DomainsCard domains={agent.agentDomains}
                            workloadId={agent.id} workloadType={'agent'}
                            readonly={readonly} />
                        <AgentVolumesCard
                            volumes={agent.agentVolumes}
                            projectId={agent.id}
                            readonly={readonly}
                        />
                        <FileMountsCard
                            fileMounts={agent.agentFileMounts}
                            workloadId={agent.id}
                            workloadType={'agent'}
                            readonly={readonly}
                        />
                        <AgentEnvVarsCard agent={agent} readonly={readonly} />
                    </div>
                </TabsContent>

                <TabsContent value="instances" className="pt-4">
                    <AgentInstancesCard
                        agentId={agent.id}
                        readonly={readonly}
                        namespace={agent.projectId}
                        agentDomains={agent.agentDomains}
                    />
                </TabsContent>
                {hasGitSource && (
                    <TabsContent value="builds" className="pt-4">
                        <WorkloadBuildsTable
                            workloadId={agent.id}
                            workloadType="agent"
                            card
                            title="Builds"
                            description="Overview of build jobs for this Agent."
                            hideSearchBar
                        />
                    </TabsContent>
                )}
            </Tabs>
        </>
    );
}
