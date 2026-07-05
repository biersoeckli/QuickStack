'use client';

import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { UserSession } from "@/shared/model/sim-session.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { Bot, Eye, MoreHorizontal, Trash } from "lucide-react";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import CreateProjectActions from "./create-project-actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteAgent } from "./actions";
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
    const canCreate = UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(session, projectId);
    const canDelete = UserGroupUtils.sessionCanDeleteAgentsForProject(session, projectId);
    const { openConfirmDialog } = useConfirmDialog();

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
                    ['modelAlias', 'Model Aliases', true, (item: AgentExtendedModel) => item.modelAlias.join(', ')],
                    ['createdAt', 'Created', true, (item: AgentExtendedModel) =>
                        new Date(item.createdAt).toLocaleDateString()
                    ],
                ]}
                data={agents}
                actionCol={(item) => (
                    <div className="flex justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <Link href={`/project/agent/${item.id}`}>
                                    <DropdownMenuItem>
                                        <Eye /> <span>Show Agent Details</span>
                                    </DropdownMenuItem>
                                </Link>
                                {canDelete && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-500"
                                            onClick={() => openConfirmDialog({
                                                title: "Delete Agent",
                                                description: "Are you sure you want to delete this agent? All data will be lost and this action cannot be undone.",
                                            }).then((result) => result ? Toast.fromAction(() => deleteAgent(item.id), 'Agent deleted successfully') : undefined)}
                                        >
                                            <Trash /> <span>Delete Agent</span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
                tableIdentifier="agent-list"
            />
        </div>
    );
}
