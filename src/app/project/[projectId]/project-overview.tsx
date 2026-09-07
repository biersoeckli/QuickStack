'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppTable from "./apps-table";
import ProjectNetworkGraph from "./project-network-graph";
import { UserSession } from "@/shared/model/sim-session.model";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, Network, Container } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import CreateProjectActions from "./create-project-actions";
import PageTitle from "@/components/custom/page-title";

interface ProjectOverviewProps {
    apps: any[]; // Using any to avoid complex type imports, as we know the data structure is correct
    session: UserSession;
    projectId: string;
    projectName: string;
}

type ProjectOverviewTab = 'table' | 'graph';

function isProjectOverviewTab(value: string | null): value is ProjectOverviewTab {
    return value === 'table' || value === 'graph';
}

function tabStorageKey(projectId: string) {
    return `quickstack:project-overview-tab:${projectId}`;
}

export default function ProjectOverview({ apps, session, projectId, projectName }: ProjectOverviewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedTab = searchParams.get('tab');
    const [currentTab, setCurrentTab] = useState<ProjectOverviewTab>('table');

    useEffect(() => {
        if (isProjectOverviewTab(requestedTab)) {
            setCurrentTab(requestedTab);
            return;
        }
        const savedTab = window.localStorage.getItem(tabStorageKey(projectId));
        setCurrentTab(isProjectOverviewTab(savedTab) ? savedTab : 'table');
    }, [projectId, requestedTab]);

    const handleTabChange = (value: string) => {
        if (!isProjectOverviewTab(value)) return;
        setCurrentTab(value);
        window.localStorage.setItem(tabStorageKey(projectId), value);
        router.push(`?tab=${value}`, { scroll: false });
    };

    const canCreate = UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(session, projectId);

    if (apps.length === 0 && !canCreate) {
        return (
            <>
                <PageTitle title="Apps" subtitle={`App Project "${projectName}"`} />
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Container />
                        </EmptyMedia>
                        <EmptyTitle>No Apps</EmptyTitle>
                        <EmptyDescription>
                            No apps available in this project.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </>
        );
    }

    if (apps.length === 0) {
        return (
            <>
                <PageTitle title="Apps" subtitle={`App Project "${projectName}"`}>
                    <CreateProjectActions projectId={projectId} projectType="app" />
                </PageTitle>
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Container />
                        </EmptyMedia>
                        <EmptyTitle>No Apps yet</EmptyTitle>
                        <EmptyDescription>
                            Create your first App to get started.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </>
        );
    }

    return (
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <PageTitle title="Apps" subtitle={`App Project "${projectName}"`}>
                <div className="flex items-center gap-2">
                    <TabsList>
                        <TabsTrigger value="table" aria-label="Table view" title="Table view">
                            <Table className="size-4" />
                        </TabsTrigger>
                        <TabsTrigger value="graph" aria-label="Network graph view" title="Network graph view">
                            <Network className="size-4" />
                        </TabsTrigger>
                    </TabsList>
                    {canCreate && <CreateProjectActions projectId={projectId} projectType="app" />}
                </div>
            </PageTitle>
            <TabsContent value="table">
                <AppTable session={session} app={apps} projectId={projectId} />
            </TabsContent>
            <TabsContent value="graph">
                <ProjectNetworkGraph apps={apps} projectId={projectId} />
            </TabsContent>
        </Tabs>
    );
}
