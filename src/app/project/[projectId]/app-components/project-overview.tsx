'use client';

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectNetworkGraph from "../app-components/project-network-graph";
import { UserSession } from "@/shared/model/sim-session.model";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Table, Network, Container } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import CreateProjectActions from "../create-project-actions";
import PageTitle from "@/components/custom/page-title";
import { TabNavigationUtils } from "@/frontend/utils/tab-navigation.utils";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import type { ProjectNetworkGraphPositions } from '@/shared/model/project-network-graph-layout.model';
import { useDialog } from "@/frontend/states/zustand.states";
import NewNetworkPolicyExplanationDialog from './new-network-policy-explanation-dialog';
import type { S3Target } from '@prisma/client';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';
import WorkloadsTable from '../workloads-table';

interface ProjectOverviewProps {
    apps: AppExtendedModel[];
    agents: AgentExtendedModel[];
    agentsAvailable: boolean;
    session: UserSession;
    projectId: string;
    projectName: string;
    networkGraphPositions: ProjectNetworkGraphPositions;
    showNewNetworkPolicyExplanation: boolean;
    s3Targets: S3Target[];
    storageClasses: string[];
    volumeBackupsByApp: Record<string, VolumeBackupExtendedModel[]>;
    gitSshPublicKeysByApp: Record<string, string | undefined>;
}

type ProjectOverviewTab = 'table' | 'graph';

function isProjectOverviewTab(value: string | null): value is ProjectOverviewTab {
    return value === 'table' || value === 'graph';
}

function tabStorageKey() {
    return `quickstack:project-overview-tab`;
}

export default function AppProjectOverview({
    apps,
    agents,
    agentsAvailable,
    session,
    projectId,
    projectName,
    networkGraphPositions,
    showNewNetworkPolicyExplanation,
    s3Targets,
    storageClasses,
    volumeBackupsByApp,
    gitSshPublicKeysByApp,
}: ProjectOverviewProps) {
    const searchParams = useSearchParams();
    const { openDialog } = useDialog();
    const requestedTab = searchParams.get('tab');
    const [currentTab, setCurrentTab] = useState<ProjectOverviewTab>('graph');

    useEffect(() => {
        if (!showNewNetworkPolicyExplanation || apps.length === 0) {
            return;
        }

        void openDialog(<NewNetworkPolicyExplanationDialog />, {
            width: 'min(720px, calc(100vw - 2rem))',
            maxWidth: '720px',
        });
    }, [openDialog, showNewNetworkPolicyExplanation, apps.length]);

    useEffect(() => {
        if (isProjectOverviewTab(requestedTab)) {
            setCurrentTab(requestedTab);
            return;
        }
        const savedTab = window.localStorage.getItem(tabStorageKey());
        setCurrentTab(isProjectOverviewTab(savedTab) ? savedTab : 'graph');
    }, [projectId, requestedTab]);

    const handleTabChange = (value: string) => {
        if (!isProjectOverviewTab(value)) return;
        setCurrentTab(value);
        window.localStorage.setItem(tabStorageKey(), value);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', value);
        TabNavigationUtils.replaceQuery(params);
    };

    const canCreate = UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(session, projectId);
    const hasWorkloads = apps.length > 0 || agents.length > 0;

    if (!hasWorkloads && !canCreate) {
        return (
            <>
                <PageTitle title="Workloads" subtitle={`Project "${projectName}"`} />
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Container />
                        </EmptyMedia>
                        <EmptyTitle>No Workloads</EmptyTitle>
                        <EmptyDescription>
                            No apps or agents available in this project.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </>
        );
    }

    if (!hasWorkloads) {
        return (
            <>
                <PageTitle title="Workloads" subtitle={`Project "${projectName}"`}>
                    <CreateProjectActions currentlyOpenedTab={currentTab} projectId={projectId} agentsAvailable={agentsAvailable} />
                </PageTitle>
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Container />
                        </EmptyMedia>
                        <EmptyTitle>No Workloads yet</EmptyTitle>
                        <EmptyDescription>
                            Create your first App or Agent to get started.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </>
        );
    }

    return (
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <PageTitle title="Workloads" subtitle={`Project "${projectName}"`}>
                <div className="flex items-center gap-2">
                    <TabsList>
                        <TabsTrigger value="graph" aria-label="Network graph view" title="Network graph view" className="hidden md:inline-flex">
                            <Network className="size-4" />
                        </TabsTrigger>
                        <TabsTrigger value="table" aria-label="Table view" title="Table view">
                            <Table className="size-4" />
                        </TabsTrigger>
                    </TabsList>
                    {canCreate && <CreateProjectActions currentlyOpenedTab={currentTab} projectId={projectId} agentsAvailable={agentsAvailable} />}
                </div>
            </PageTitle>
            <div className={currentTab === 'table' ? 'block' : 'block md:hidden'}>
                <WorkloadsTable session={session} apps={apps} agents={agents} projectId={projectId} />
            </div>
            <div className={currentTab === 'graph' ? 'hidden md:block' : 'hidden'} data-project-network-graph>
                <ProjectNetworkGraph
                    apps={apps}
                    agents={agents}
                    agentsAvailable={agentsAvailable}
                    projectId={projectId}
                    session={session}
                    savedPositions={networkGraphPositions}
                    s3Targets={s3Targets}
                    storageClasses={storageClasses}
                    volumeBackupsByApp={volumeBackupsByApp}
                    gitSshPublicKeysByApp={gitSshPublicKeysByApp}
                />
            </div>
        </Tabs>
    );
}
