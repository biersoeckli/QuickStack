'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppTable from "./apps-table";
import ProjectNetworkGraph from "./project-network-graph";
import { UserSession } from "@/shared/model/sim-session.model";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, Network, Container } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import CreateProjectActions from "./create-project-actions";

interface ProjectOverviewProps {
    apps: any[]; // Using any to avoid complex type imports, as we know the data structure is correct
    session: UserSession;
    projectId: string;
}

export default function ProjectOverview({ apps, session, projectId }: ProjectOverviewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'table';

    const handleTabChange = (value: string) => {
        router.push(`?tab=${value}`, { scroll: false });
    };

    const canCreate = UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(session, projectId);

    if (apps.length === 0 && !canCreate) {
        return (
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
        );
    }

    if (apps.length === 0) {
        return (
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
                <EmptyContent>
                    <CreateProjectActions projectId={projectId} projectType="app" />
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <TabsList>
                <TabsTrigger value="table"><Table className="mr-2 h-4 w-4" />Table View</TabsTrigger>
                <TabsTrigger value="graph"><Network className="mr-2 h-4 w-4" />Network Graph</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
                <AppTable session={session} app={apps} projectId={projectId} />
            </TabsContent>
            <TabsContent value="graph">
                <ProjectNetworkGraph apps={apps} />
            </TabsContent>
        </Tabs>
    );
}
