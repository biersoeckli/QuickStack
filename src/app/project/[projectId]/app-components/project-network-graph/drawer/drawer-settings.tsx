'use client';

import {
    Boxes,
    Globe2,
    HardDrive,
    Network,
    SlidersHorizontal,
    Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import BasicAuth from '@/app/project/app/[appId]/advanced/basic-auth';
import { saveHealthCheck } from '@/app/project/app/[appId]/advanced/actions';
import HealthCheckSettings from '@/app/project/app/[appId]/advanced/health-check-settings';
import NetworkPolicy from '@/app/project/app/[appId]/advanced/network-policy';
import NodePortsCard from '@/app/project/app/[appId]/domains/node-ports';
import EnvEdit from '@/app/project/app/[appId]/environment/env-edit';
import GeneralAppContainerConfig from '@/app/project/app/[appId]/general/app-container-config';
import GeneralAppRateLimits from '@/app/project/app/[appId]/general/app-rate-limits';
import GeneralAppSource from '@/app/project/app/[appId]/general/app-source';
import StorageList from '@/app/project/app/[appId]/volumes/storages';
import DomainsCard from '@/components/custom/domains-card';
import FileMountsCard from '@/components/custom/file-mounts-card';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import { SettingsSection } from './settings-section';
import { DrawerEnvironment } from './drawer-environment';
import { useNestedDrawer } from './nested-drawer';

export function DrawerSettings({
    app,
    role,
    storageClasses,
    gitSshPublicKey,
}: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
    storageClasses: string[];
    gitSshPublicKey?: string;
}) {
    const readonly = role !== RolePermissionEnum.READWRITE;
    const { openNestedDrawer } = useNestedDrawer();

    return (
        <div className="relative grid gap-16 grid-cols-1 lg:grid-cols-[1fr_auto]">
            <div className="pb-4 space-y-10 [&_[data-slot=card-footer]]:mt-4">
                <SettingsSection
                    id="source"
                    title="Source"
                    icon={Boxes}
                >
                    <GeneralAppSource
                        hideCard
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
                    <GeneralAppRateLimits app={app} readonly={readonly} hideCard />
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
                </SettingsSection>
                <SettingsSection
                    id="environment"
                    title="Environment"
                    icon={Zap}
                >
                    <DrawerEnvironment
                        app={app}
                        onEdit={() =>
                            openNestedDrawer({
                                title: 'Environment variables',
                                content: (
                                    <EnvEdit
                                        app={app}
                                        readonly={readonly}
                                        hideCard={false}
                                    />
                                ),
                            })
                        }
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
                        hideCard
                    />
                    <NodePortsCard app={app} readonly={readonly} hideCard />
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
                                        hideCard={false}
                                    />
                                ),
                            })
                        }>
                        Edit network policies
                    </Button>
                </SettingsSection>
                <SettingsSection id="storage" title="Storage" icon={HardDrive}>
                    <StorageList
                        app={app}
                        readonly={readonly}
                        storageClasses={storageClasses}
                        hideCard
                    />
                    <FileMountsCard
                        readonly={readonly}
                        fileMounts={app.appFileMounts}
                        workloadId={app.id}
                        workloadType="app"
                        hideCard
                    />
                </SettingsSection>
                <SettingsSection
                    id="advanced"
                    title="Advanced"
                    icon={Globe2}
                >
                    <BasicAuth app={app} readonly={readonly} hideCard />
                    <div>
                        <CardHeader>
                            <CardTitle>Health Checks</CardTitle>
                            <CardDescription>
                                Configure healthchecks so that k3s can automatically monitor when your application is fully started up and ready to receive traffic (In kubernetes terms, startup, readiness and liveness probes).
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
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
                                                hideCard={false}
                                            />
                                        ),
                                    })
                                }
                            >
                                Edit health checks
                            </Button>
                        </CardFooter>
                    </div>
                </SettingsSection>
            </div>
        </div>
    );
}
