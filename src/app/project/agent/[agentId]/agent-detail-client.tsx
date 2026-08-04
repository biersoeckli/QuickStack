'use client';

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { Bot, Boxes, Code2, Container, Globe2, Hammer, KeyRound, MessageSquareText, Settings } from "lucide-react";
import AgentSourceCard from "./general/agent-source-card";
import AgentModelConfigurationCard from "./general/agent-model-configuration-card";
import AgentRateLimitsCard from "./general/agent-rate-limits-card";
import AgentContainerConfigCard from "./general/agent-container-config-card";
import AgentSystemPromptCard from "./general/agent-system-prompt-card";
import AgentEnvVarsCard from "./general/agent-env-vars-card";
import AgentStatusBar from "./general/agent-status-bar";
import AgentSandboxesCard from "./sandboxes/agent-sandboxes-card";
import { AgentSandboxTemplateInfo } from "@/shared/model/agent-sandbox-template-info.model";
import DomainsCard from "@/components/custom/domains-card";
import AgentVolumesCard from "@/app/project/agent/[agentId]/general/agent-volumes-card";
import FileMountsCard from "@/components/custom/file-mounts-card";
import AgentNetworkPolicyCard from "./general/agent-network-policy-card";
import HealthCheckSettings from "@/app/project/app/[appId]/advanced/health-check-settings";
import { saveAgentHealthCheck } from "./general/actions";
import WorkloadBuildsTable from "@/components/custom/workload-builds-table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/frontend/utils/utils";

type ConfigurationSection = "source" | "prompt" | "container" | "storage" | "networking" | "secrets";

const configurationSections: {
    value: ConfigurationSection;
    label: string;
    icon: typeof Boxes;
}[] = [
        { value: "source", label: "Source", icon: Code2 },
        { value: "prompt", label: "Prompt", icon: MessageSquareText },
        { value: "container", label: "Container", icon: Container },
        { value: "storage", label: "Storage", icon: Boxes },
        { value: "networking", label: "Networking", icon: Globe2 },
        { value: "secrets", label: "Secrets", icon: KeyRound },
    ];

const isConfigurationSection = (section: string | null): section is ConfigurationSection =>
    configurationSections.some((item) => item.value === section);

export default function AgentDetailClient({ agent, role, templateInfo, storageClasses }: {
    agent: AgentExtendedModel;
    templateInfo?: AgentSandboxTemplateInfo;
    role: RolePermissionEnum | null;
    storageClasses: string[];
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawTabName = searchParams.get('tabName') || 'sandboxes';
    const tabName = rawTabName === 'general' ? 'configuration' : rawTabName;
    const sectionName = searchParams.get('section');
    const readonly = role !== RolePermissionEnum.READWRITE;
    const hasGitSource = agent.sourceType === 'GIT' || agent.sourceType === 'GIT_SSH';
    const hasBuildsTab = !readonly && hasGitSource;
    const requestedTabAllowed = tabName === 'sandboxes'
        || (!readonly && tabName === 'configuration')
        || (hasBuildsTab && tabName === 'builds');
    const activeTab = requestedTabAllowed ? tabName : 'sandboxes';
    const activeSection = isConfigurationSection(sectionName) ? sectionName : 'source';

    useEffect(() => {
        if (!requestedTabAllowed || rawTabName === 'general') {
            const params = new URLSearchParams();
            params.set('tabName', activeTab);

            if (activeTab === 'configuration') {
                params.set('section', activeSection);
            }

            router.replace(`/project/agent/${agent.id}?${params.toString()}`);
        }
    }, [activeSection, activeTab, agent.id, rawTabName, requestedTabAllowed, router]);

    const openTab = (tab: string) => {
        const params = new URLSearchParams();
        params.set('tabName', tab);

        if (tab === 'configuration') {
            params.set('section', activeSection);
        }

        router.push(`/project/agent/${agent.id}?${params.toString()}`);
    };

    const openSection = (section: ConfigurationSection) => {
        const params = new URLSearchParams();
        params.set('tabName', 'configuration');
        params.set('section', section);
        router.push(`/project/agent/${agent.id}?${params.toString()}`);
    };

    const renderConfigurationSection = () => {
        switch (activeSection) {
            case 'source':
                return <div className="space-y-4">
                    <AgentSourceCard agent={agent} readonly={readonly} />
                    <AgentModelConfigurationCard agent={agent} readonly={readonly} />
                </div>
            case 'prompt':
                return <AgentSystemPromptCard agent={agent} readonly={readonly} />;
            case 'container':
                return (
                    <div className="space-y-4">
                        <AgentContainerConfigCard agent={agent} readonly={readonly} />
                        <AgentRateLimitsCard agent={agent} readonly={readonly} />
                        <HealthCheckSettings workload={agent} readonly={readonly} saveHealthCheck={saveAgentHealthCheck} />
                    </div>
                );
            case 'storage':
                return (
                    <div className="space-y-4">
                        <AgentVolumesCard
                            volumes={agent.agentVolumes}
                            projectId={agent.id}
                            readonly={readonly}
                            storageClasses={storageClasses}
                        />
                        <FileMountsCard
                            fileMounts={agent.agentFileMounts}
                            workloadId={agent.id}
                            workloadType={'agent'}
                            readonly={readonly}
                        />
                    </div>
                );
            case 'networking':
                return (
                    <div className="space-y-4">
                        <DomainsCard
                            domains={agent.agentDomains}
                            workloadId={agent.id}
                            workloadType={'agent'}
                            readonly={readonly}
                        />
                        <AgentNetworkPolicyCard agent={agent} readonly={readonly} />
                    </div>
                );
            case 'secrets':
                return <AgentEnvVarsCard agent={agent} readonly={readonly} />;
        }
    };

    return (
        <>
            <Tabs value={activeTab} onValueChange={openTab}>
                <TabsList>
                    <TabsTrigger value="sandboxes"><Bot className="mr-2 h-4 w-4" /> Sandboxes</TabsTrigger>
                    {hasBuildsTab && <TabsTrigger value="builds"><Hammer className="mr-2 h-4 w-4" />Builds</TabsTrigger>}
                    {!readonly && <TabsTrigger value="configuration"><Settings className="mr-2 h-4 w-4" />Configuration</TabsTrigger>}
                </TabsList>

                {!readonly && (
                    <TabsContent value="configuration" className="pt-4">
                        <div className="space-y-4">
                            <div className="sticky top-0 z-10 bg-background/95 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                <AgentStatusBar agent={agent} readonly={readonly} templateInfo={templateInfo} />
                            </div>

                            <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
                                <aside className="md:sticky md:top-24 md:self-start">
                                    <ScrollArea className="w-full">
                                        <nav className="flex gap-2 pb-2 md:flex-col md:pb-0">
                                            {configurationSections.map((section) => {
                                                const Icon = section.icon;

                                                return (
                                                    <Button
                                                        key={section.value}
                                                        type="button"
                                                        variant="ghost"
                                                        className={cn(
                                                            "h-10 shrink-0 justify-start gap-2 px-3",
                                                            activeSection === section.value && "bg-muted text-foreground"
                                                        )}
                                                        onClick={() => openSection(section.value)}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                        <span>{section.label}</span>
                                                    </Button>
                                                );
                                            })}
                                        </nav>
                                    </ScrollArea>
                                </aside>

                                <section className="min-w-0 space-y-4">
                                    {renderConfigurationSection()}
                                </section>
                            </div>
                        </div>
                    </TabsContent>
                )}

                <TabsContent value="sandboxes" className="pt-4">
                    <AgentSandboxesCard
                        agentId={agent.id}
                        readonly={readonly}
                        namespace={agent.projectId}
                        agentDomains={agent.agentDomains}
                    />
                </TabsContent>
                {hasBuildsTab && (
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
