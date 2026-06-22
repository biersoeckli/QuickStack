'use client';

import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { UserSession } from "@/shared/model/sim-session.model";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateAgentDialog } from "./create-agent-dialog";
import { useRouter } from "next/navigation";
import { UserGroupUtils } from "@/shared/utils/role.utils";

interface AgentListClientProps {
    agents: AgentWithRelationsModel[];
    session: UserSession;
    projectId: string;
}

export default function AgentListClient({ agents, session, projectId }: AgentListClientProps) {
    const router = useRouter();
    const canCreate = UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(session, projectId);

    if (agents.length === 0 && !canCreate) {
        return (
            <div className="rounded-lg border border-dashed p-12 text-center">
                <h3 className="text-lg font-semibold">No Agents</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    No agents available in this project.
                </p>
            </div>
        );
    }

    if (agents.length === 0) {
        return (
            <div className="rounded-lg border border-dashed p-12 text-center">
                <h3 className="text-lg font-semibold">No Agents yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Create your first Agent to get started.
                </p>
                <div className="mt-4">
                    <CreateAgentDialog projectId={projectId}>
                        <Button><Plus className="mr-2 h-4 w-4" /> Create Agent</Button>
                    </CreateAgentDialog>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {canCreate && (
                <div className="flex justify-end">
                    <CreateAgentDialog projectId={projectId}>
                        <Button><Plus className="mr-2 h-4 w-4" /> Create Agent</Button>
                    </CreateAgentDialog>
                </div>
            )}
            <SimpleDataTable
                columns={[
                    ['name', 'Name', true, (item: AgentWithRelationsModel) => (
                        <span
                            className="font-medium cursor-pointer hover:underline"
                            onClick={() => router.push(`/project/agent/${item.id}`)}
                        >
                            {item.name}
                        </span>
                    )],
                    ['llmGateway.name', 'LLM Gateway', true],
                    ['modelAlias', 'Model Alias', true],
                    ['createdAt', 'Created', true, (item: AgentWithRelationsModel) =>
                        new Date(item.createdAt).toLocaleDateString()
                    ],
                ]}
                data={agents}
                tableIdentifier="agent-list"
            />
        </div>
    );
}
