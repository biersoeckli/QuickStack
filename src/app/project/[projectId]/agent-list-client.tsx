'use client';

import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { UserSession } from "@/shared/model/sim-session.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { CreateAgentDialog } from "./create-agent-dialog";
import { useRouter } from "next/navigation";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import CreateProjectActions from "./create-project-actions";
import Link from "next/link";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";

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
            <Empty className="border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Bot />
                    </EmptyMedia>
                    <EmptyTitle>No Agents</EmptyTitle>
                    <EmptyDescription>
                        No agents available in this project.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    if (agents.length === 0) {
        return (
            <Empty className="border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Bot />
                    </EmptyMedia>
                    <EmptyTitle>No Agents yet</EmptyTitle>
                    <EmptyDescription>
                        Create your first Agent to get started.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <CreateProjectActions projectId={projectId} projectType="agent" />
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <div className="space-y-4">
            <SimpleDataTable
                columns={[
                    ['name', 'Name', true, (item: AgentExtendedModel) => (
                        <Link href={`/project/agent/${item.id}`}
                            className="font-medium cursor-pointer hover:underline">
                            {item.name}
                        </Link>
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
