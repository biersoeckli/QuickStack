'use client';

import {
    Boxes,
    Container,
    HardDrive,
    KeyRound,
    Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSection } from '@/app/project/[projectId]/app-components/app-drawer-components/settings-section';
import { useNestedDrawer } from '@/app/project/[projectId]/app-components/app-drawer-components/nested-drawer';
import AgentSourceCard from './configuration/agent-source-card';
import AgentModelConfigurationCard from './configuration/agent-model-configuration-card';
import { AgentModelConfigurationEditor } from './configuration/agent-model-configuration-editor';
import AgentContainerConfigCard from './configuration/agent-container-config-card';
import AgentRateLimitsCard from './configuration/agent-rate-limits-card';
import AgentVolumesCard from './configuration/agent-volumes-card';
import AgentNetworkPolicyCard from './configuration/agent-network-policy-card';
import AgentEnvVarsCard from './configuration/agent-env-vars-card';
import HealthCheckSettings from '@/app/project/app/[appId]/advanced/health-check-settings';
import { saveAgentHealthCheck } from './configuration/actions';
import DomainsCard from '@/components/custom/domains-card';
import FileMountsCard from '@/components/custom/file-mounts-card';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';
import { DrawerCard, DrawerCardDescription, DrawerCardFooter, DrawerCardHeader, DrawerCardTitle } from '@/components/custom/drawer-card';

export default function AgentSandboxDrawerSettings({
    agent,
    readonly,
    storageClasses,
    runtimeClasses,
}: {
    agent: AgentExtendedModel;
    readonly: boolean;
    storageClasses: string[];
    runtimeClasses: string[];
}) {
    const { openNestedDrawer } = useNestedDrawer();

    return (
        <div className="space-y-10 pb-4 [&_[data-slot=card-footer]]:mt-4">
            <SettingsSection id="source" title="Source" icon={Boxes}>
                <AgentSourceCard agent={agent} readonly={readonly} />
                <AgentModelConfigurationCard
                    agent={agent}
                    readonly={readonly}
                    onEdit={() =>
                        openNestedDrawer({
                            title: 'LLM Gateway configuration',
                            description: 'Configure the LLM gateway and model aliases for this agent.',
                            content: <AgentModelConfigurationEditor agent={agent} readonly={readonly} />,
                        })
                    }
                />
            </SettingsSection>

            <SettingsSection id="container" title="Container" icon={Container}>
                <AgentRateLimitsCard agent={agent} readonly={readonly} />
                <DrawerCard>
                    <DrawerCardHeader>
                        <DrawerCardTitle>Advanced Container Configuration</DrawerCardTitle>
                        <DrawerCardDescription>Configure the container command, arguments, isolation and other advanced settings.</DrawerCardDescription>
                    </DrawerCardHeader>
                    <DrawerCardFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                openNestedDrawer({
                                    title: 'Advanced container settings',
                                    content: <AgentContainerConfigCard agent={agent} readonly={readonly} runtimeClasses={runtimeClasses} />,
                                })
                            }>
                            Advanced container settings
                        </Button>
                    </DrawerCardFooter>
                </DrawerCard>
                <DrawerCard>
                    <DrawerCardHeader>
                        <DrawerCardTitle>Health Checks</DrawerCardTitle>
                        <DrawerCardDescription>Configure the health to determine when the Agent Sandbox is ready.</DrawerCardDescription>
                    </DrawerCardHeader>
                    <DrawerCardFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                openNestedDrawer({
                                    title: 'Health checks',
                                    content: (
                                        <HealthCheckSettings
                                            readonly={readonly}
                                            workload={agent}
                                            saveHealthCheck={saveAgentHealthCheck}
                                            hideCard={false}
                                        />
                                    ),
                                })
                            }>
                            Edit health checks
                        </Button>

                    </DrawerCardFooter>
                </DrawerCard>
            </SettingsSection>

            <SettingsSection id="secrets" title="Environment" icon={KeyRound}>
                <AgentEnvVarsCard agent={agent} readonly={readonly} />
            </SettingsSection>

            <SettingsSection id="storage" title="Storage" icon={HardDrive}>
                <AgentVolumesCard
                    volumes={agent.agentVolumes}
                    projectId={agent.id}
                    readonly={readonly}
                    storageClasses={storageClasses}
                />
                <FileMountsCard
                    fileMounts={agent.agentFileMounts}
                    workloadId={agent.id}
                    workloadType="agent"
                    readonly={readonly}
                    hideCard
                />
            </SettingsSection>

            <SettingsSection id="networking" title="Networking" icon={Network}>
                <DomainsCard
                    domains={agent.agentDomains}
                    workloadId={agent.id}
                    workloadType="agent"
                    readonly={readonly}
                    hideCard
                />
                <DrawerCard>
                    <DrawerCardHeader>
                        <DrawerCardTitle>Network Policies</DrawerCardTitle>
                        <DrawerCardDescription>Configure the policies to control the traffic from the Agent Sandbox.</DrawerCardDescription>
                    </DrawerCardHeader>
                    <DrawerCardFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                openNestedDrawer({
                                    title: 'Network policies',
                                    content: <AgentNetworkPolicyCard agent={agent} readonly={readonly} />,
                                })
                            }>
                            Edit network policies
                        </Button>
                    </DrawerCardFooter>
                </DrawerCard>
            </SettingsSection>

        </div>
    );
}
