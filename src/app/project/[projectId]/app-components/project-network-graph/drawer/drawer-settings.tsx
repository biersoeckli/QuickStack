'use client';

import {
    Boxes,
    Globe2,
    HardDrive,
    Key,
    Network,
    SlidersHorizontal,
    Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/frontend/utils/utils';
import BasicAuth from '@/app/project/app/[appId]/advanced/basic-auth';
import { saveHealthCheck } from '@/app/project/app/[appId]/advanced/actions';
import HealthCheckSettings from '@/app/project/app/[appId]/advanced/health-check-settings';
import NetworkPolicy from '@/app/project/app/[appId]/advanced/network-policy';
import NodePortsCard from '@/app/project/app/[appId]/domains/node-ports';
import EnvEdit from '@/app/project/app/[appId]/environment/env-edit';
import GeneralAppContainerConfig from '@/app/project/app/[appId]/general/app-container-config';
import GeneralAppRateLimits from '@/app/project/app/[appId]/general/app-rate-limits';
import GeneralAppSource from '@/app/project/app/[appId]/general/app-source';
import DbCredentials from '@/app/project/app/[appId]/credentials/db-crendentials';
import DbToolsCard from '@/app/project/app/[appId]/credentials/db-tools';
import StorageList from '@/app/project/app/[appId]/volumes/storages';
import VolumeBackupList from '@/app/project/app/[appId]/volumes/volume-backup';
import DomainsCard from '@/components/custom/domains-card';
import FileMountsCard from '@/components/custom/file-mounts-card';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import type { S3Target } from '@prisma/client';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';
import { SettingsSection } from './settings-section';
import { DrawerEnvironment } from './drawer-environment';
import { useNestedDrawer } from './nested-drawer';

export function DrawerSettings({
    app,
    role,
    s3Targets,
    storageClasses,
    volumeBackups,
    gitSshPublicKey,
}: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
    s3Targets: S3Target[];
    storageClasses: string[];
    volumeBackups: VolumeBackupExtendedModel[];
    gitSshPublicKey?: string;
}) {
    const readonly = role !== RolePermissionEnum.READWRITE;
    const { openNestedDrawer } = useNestedDrawer();
    const settingsSections = useMemo(
        () => [
            ...(app.appType !== 'APP'
                ? [{ id: 'credentials', label: 'Credentials' }]
                : []),
            { id: 'source', label: 'Source' },
            { id: 'deployment', label: 'Deployment' },
            { id: 'environment', label: 'Environment' },
            { id: 'networking', label: 'Networking' },
            { id: 'storage', label: 'Storage' },
            { id: 'advanced', label: 'Advanced' },
        ],
        [app.appType],
    );
    const [activeSection, setActiveSection] = useState(settingsSections[0].id);

    useEffect(() => {
        const sections = settingsSections
            .map((section) => document.getElementById(section.id))
            .filter((section): section is HTMLElement => section !== null);
        const scrollArea = sections[0]?.closest<HTMLElement>(
            '[data-slot="scroll-area-viewport"]',
        );
        const observer = new IntersectionObserver(
            (entries) => {
                const visibleSection = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (left, right) =>
                            left.boundingClientRect.top -
                            right.boundingClientRect.top,
                    )[0];

                if (visibleSection) {
                    setActiveSection(visibleSection.target.id);
                }
            },
            {
                root: scrollArea,
                rootMargin: '-5% 0px -70% 0px',
                threshold: 0,
            },
        );

        sections.forEach((section) => observer.observe(section));
        return () => observer.disconnect();
    }, [settingsSections]);

    return (
        <div className="grid gap-8 pb-4 [&_[data-slot=card-footer]]:mt-4 lg:grid-cols-3">
            <div className="space-y-10 lg:col-span-2">
            {app.appType !== 'APP' && (
                <SettingsSection id="credentials" title="Credentials" icon={Key}>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            openNestedDrawer({
                                title: 'Database credentials',
                                content: (
                                    <div className="space-y-4">
                                        {role === RolePermissionEnum.READWRITE && (
                                            <DbToolsCard app={app} />
                                        )}
                                        <DbCredentials app={app} />
                                    </div>
                                ),
                            })
                        }
                    >
                        Manage database credentials
                    </Button>
                </SettingsSection>
            )}
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
                    Advanced settings
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
                <VolumeBackupList
                    app={app}
                    readonly={readonly}
                    s3Targets={s3Targets}
                    volumeBackups={volumeBackups}
                    hideCard
                />
            </SettingsSection>
            <SettingsSection
                id="advanced"
                title="Advanced"
                icon={Globe2}
            >
                <BasicAuth app={app} readonly={readonly} hideCard />
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
            </SettingsSection>
            </div>
            <nav aria-label="Settings sections" className="hidden self-start lg:sticky lg:top-0 lg:block -mt-4">
                <div className="space-y-1 border-l border-border/70 py-1">
                    <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">
                        Sections
                    </p>
                    {settingsSections.map((section) => (
                        <Button
                            key={section.id}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                                'h-8 w-full justify-start rounded-none px-3 text-muted-foreground hover:bg-transparent hover:text-foreground',
                                activeSection === section.id &&
                                    '-ml-px border-l-2 border-l-primary font-medium text-foreground',
                            )}
                            aria-current={
                                activeSection === section.id ? 'location' : undefined
                            }
                            onClick={() =>
                                document
                                    .getElementById(section.id)
                                    ?.scrollIntoView({
                                        behavior: 'smooth',
                                        block: 'start',
                                    })
                            }
                        >
                            {section.label}
                        </Button>
                    ))}
                </div>
            </nav>
        </div>
    );
}
