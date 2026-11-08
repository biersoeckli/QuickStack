'use client';

import {
    Boxes,
    Globe2,
    HardDrive,
    Network,
    SlidersHorizontal,
    Zap,
} from 'lucide-react';
import { useCallback, useContext, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import BasicAuth from '@/app/project/[projectId]/apps/details/network/policy/basic-auth';
import { saveHealthCheck } from '@/app/project/[projectId]/apps/details/network/policy/actions';
import HealthCheckSettings from '@/app/project/workload-components/health-check-settings';
import NetworkPolicy from '@/app/project/[projectId]/apps/details/network/policy/network-policy';
import NodePortsCard from '@/app/project/[projectId]/apps/details/network/ports/node-ports-card';
import EnvEdit from '@/app/project/[projectId]/apps/details/environment/env-edit';
import GeneralAppContainerConfig from '@/app/project/[projectId]/apps/details/configuration/app-container-config';
import GeneralAppRateLimits from '@/app/project/[projectId]/apps/details/configuration/app-rate-limits';
import GeneralAppSource from '@/app/project/[projectId]/apps/details/source/app-source';
import StorageList from '@/app/project/[projectId]/apps/details/volumes/volumes-list';
import DomainsCard from '@/components/custom/domains-card';
import FileMountsCard from '@/components/custom/file-mounts-card';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model';
import { SettingsSection } from '../../../workload-components/drawer/settings-section';
import { DrawerEnvironment } from './environment/app-details-environment';
import { useNestedDrawer } from '../../../workload-components/drawer/nested-drawer';
import { AppDrawerAppContext } from './app-drawer-app-context';
import { DrawerCard, DrawerCardDescription, DrawerCardFooter, DrawerCardHeader, DrawerCardTitle } from '@/components/custom/drawer-card';

export function DrawerSettings({
    app,
    role,
    storageClasses,
    gitSshPublicKey,
    openEnvironment = false,
    onEnvironmentOpened,
}: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
    storageClasses: string[];
    gitSshPublicKey?: string;
    openEnvironment?: boolean;
    onEnvironmentOpened?: () => void;
}) {
    const readonly = role !== RolePermissionEnum.READWRITE;
    const { openNestedDrawer } = useNestedDrawer();
    const openEnvironmentEditor = useCallback(() => {
        openNestedDrawer({
            title: 'Environment variables',
            description: <>Values are encrypted at rest and never shown. Names starting with <code className="rounded bg-muted px-1 text-xs">QS_</code> are reserved by QuickStack.</>,
            content: <EnvEdit app={app} readonly={readonly} />,
        });
    }, [app, openNestedDrawer, readonly]);

    useEffect(() => {
        if (!openEnvironment) return;
        openEnvironmentEditor();
        onEnvironmentOpened?.();
    }, [onEnvironmentOpened, openEnvironment, openEnvironmentEditor]);

    return (
        <div className="relative min-w-0">
            <div className="min-w-0 pb-4 space-y-10 [&_[data-slot=card-footer]]:mt-4">
                <SettingsSection
                    id="source"
                    title="Source"
                    icon={Boxes}
                >
                    <GeneralAppSource
                        app={app}
                        readonly={readonly}
                        gitSshPublicKey={gitSshPublicKey}
                    />
                </SettingsSection>
                <SettingsSection
                    id="deployment"
                    title="Deployment"
                    icon={SlidersHorizontal}
                >
                    <GeneralAppRateLimits app={app} readonly={readonly} />

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
                                        title: 'Advanced settings',
                                        content: (
                                            <GeneralAppContainerConfig
                                                app={app}
                                                readonly={readonly}

                                            />
                                        ),
                                    })
                                }>
                                Advanced container settings
                            </Button>
                        </DrawerCardFooter>
                    </DrawerCard>
                </SettingsSection>
                <SettingsSection
                    id="environment"
                    title="Environment"
                    icon={Zap}
                >
                    <DrawerEnvironment
                        app={app}
                        onEdit={openEnvironmentEditor}
                    />
                </SettingsSection>
                <SettingsSection
                    id="networking"
                    title="Networking"
                    icon={Network}
                >
                    <DomainsCard
                        readonly={readonly}
                        domains={app.appDomains}
                        workloadId={app.id}
                        workloadType="app"
                    />
                    <DrawerCard>
                        <DrawerCardHeader>
                            <DrawerCardTitle>Network Policies</DrawerCardTitle>
                            <DrawerCardDescription>Configure network policies to control the traffic flow.</DrawerCardDescription>
                        </DrawerCardHeader>
                        <DrawerCardFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    openNestedDrawer({
                                        title: 'Network policies',
                                        content: (
                                            <NetworkPolicy
                                                app={app}
                                                readonly={readonly}
                                            />
                                        ),
                                    })
                                }>
                                Edit network policies
                            </Button>
                        </DrawerCardFooter>
                    </DrawerCard>
                    <DrawerCard>
                        <DrawerCardHeader>
                            <DrawerCardTitle>Advanced Network Settings</DrawerCardTitle>
                            <DrawerCardDescription>Configure node ports and basic authentication.</DrawerCardDescription>
                        </DrawerCardHeader>
                        <DrawerCardFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => openNestedDrawer({
                                    title: 'Advanced network settings',
                                    content: <AdvancedNetworkSettings readonly={readonly} />,
                                })}
                            >
                                Advanced network settings
                            </Button>
                        </DrawerCardFooter>
                    </DrawerCard>
                </SettingsSection>
                <SettingsSection id="storage" title="Storage" icon={HardDrive}>
                    <StorageList
                        app={app}
                        readonly={readonly}
                        storageClasses={storageClasses}
                    />
                    <FileMountsCard
                        readonly={readonly}
                        fileMounts={app.appFileMounts}
                        workloadId={app.id}
                        workloadType="app"
                    />
                </SettingsSection>
                <SettingsSection
                    id="advanced"
                    title="Advanced"
                    icon={Globe2}
                >
                    <DrawerCard>
                        <DrawerCardHeader>
                            <DrawerCardTitle>Health Checks</DrawerCardTitle>
                            <DrawerCardDescription>
                                Configure healthchecks so that k3s can automatically monitor when your application is fully started up and ready to receive traffic.
                            </DrawerCardDescription>
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
                                                workload={app}
                                                saveHealthCheck={saveHealthCheck}
                                            />
                                        ),
                                    })
                                }
                            >
                                Edit health checks
                            </Button>
                        </DrawerCardFooter>
                    </DrawerCard>
                </SettingsSection>
            </div>
        </div>
    );
}

function AdvancedNetworkSettings({ readonly }: { readonly: boolean }) {
    const app = useContext(AppDrawerAppContext);
    if (!app) return null;

    return <div className="flex flex-col gap-6">
        <NodePortsCard app={app} readonly={readonly} />
        <BasicAuth app={app} readonly={readonly} />
    </div>;
}
