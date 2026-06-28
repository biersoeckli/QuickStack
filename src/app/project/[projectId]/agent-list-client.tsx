'use client';

import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { UserSession } from "@/shared/model/sim-session.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateAgentDialog } from "./create-agent-dialog";
import { useRouter } from "next/navigation";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import CreateProjectActions from "./create-project-actions";

interface AgentListClientProps {
    agents: AgentExtendedModel[];
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
                    <CreateProjectActions projectId={projectId} projectType="agent" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SimpleDataTable
                columns={[
                    ['name', 'Name', true, (item: AgentExtendedModel) => (
                        <span
                            className="font-medium cursor-pointer hover:underline"
                            onClick={() => router.push(`/project/agent/${item.id}`)}
                        >
                            {item.name}
                        </span>
                    )],
                    ['llmGateway.name', 'LLM Gateway', true],
                    ['modelAlias', 'Model Alias', true],
                    ['createdAt', 'Created', true, (item: AgentExtendedModel) =>
                        new Date(item.createdAt).toLocaleDateString()
                    ],
                ]}
                data={agents}
                tableIdentifier="agent-list"
            />
        </div>
    );
}
