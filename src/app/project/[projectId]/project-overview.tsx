'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppTable from "./apps-table";
import ProjectNetworkGraph from "./project-network-graph";
import { UserSession } from "@/shared/model/sim-session.model";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, Network } from "lucide-react";

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
