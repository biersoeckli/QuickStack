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
import AgentSourceCard from '@/app/project/agent/[agentId]/general/agent-source-card';
import AgentModelConfigurationCard from '@/app/project/agent/[agentId]/general/agent-model-configuration-card';
import AgentContainerConfigCard from '@/app/project/agent/[agentId]/general/agent-container-config-card';
import AgentRateLimitsCard from '@/app/project/agent/[agentId]/general/agent-rate-limits-card';
import AgentVolumesCard from '@/app/project/agent/[agentId]/general/agent-volumes-card';
import AgentNetworkPolicyCard from '@/app/project/agent/[agentId]/general/agent-network-policy-card';
import AgentEnvVarsCard from '@/app/project/agent/[agentId]/general/agent-env-vars-card';
import HealthCheckSettings from '@/app/project/app/[appId]/advanced/health-check-settings';
import { saveAgentHealthCheck } from '@/app/project/agent/[agentId]/general/actions';
import DomainsCard from '@/components/custom/domains-card';
import FileMountsCard from '@/components/custom/file-mounts-card';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';

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
                <AgentModelConfigurationCard agent={agent} readonly={readonly} />
            </SettingsSection>

            <SettingsSection id="container" title="Container" icon={Container}>
                <AgentRateLimitsCard agent={agent} readonly={readonly} />
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
                <div>
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
                </div>
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
            </SettingsSection>

            <SettingsSection id="secrets" title="Secrets" icon={KeyRound}>
                <AgentEnvVarsCard agent={agent} readonly={readonly} />
            </SettingsSection>
        </div>
    );
}
