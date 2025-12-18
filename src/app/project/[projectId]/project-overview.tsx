'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppTable from "./apps-table";
import ProjectNetworkGraph from "./project-network-graph";
import { App } from "@prisma/client";
import { UserSession } from "@/shared/model/sim-session.model";

interface ProjectOverviewProps {
    apps: any[]; // Using any to avoid complex type imports, as we know the data structure is correct
    session: UserSession;
    projectId: string;
}

export default function ProjectOverview({ apps, session, projectId }: ProjectOverviewProps) {
    return (
        <Tabs defaultValue="table" className="w-full">
            <TabsList>
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="graph">Network Graph</TabsTrigger>
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
