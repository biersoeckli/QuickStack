'use client';

import Link from 'next/link';
import { Edit2, Eye, MoreHorizontal, Trash } from 'lucide-react';
import { SimpleDataTable } from '@/components/custom/simple-data-table';
import PodStatusIndicator from '@/components/custom/pod-status-indicator';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmDialog, useDialog } from '@/frontend/states/zustand.states';
import { formatDateTime } from '@/frontend/utils/format.utils';
import { Toast } from '@/frontend/utils/toast.utils';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import type { UserSession } from '@/shared/model/sim-session.model';
import { PathBuilderUtils } from '@/shared/utils/path-builder.utils';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { deleteAgent, deleteApp } from './actions';
import { RenameAgentDialog } from './agent-components/rename-agent-dialog';
import { EditAppDialog } from './app-components/edit-app-dialog';

type WorkloadRow =
    | ({ kind: 'APP' } & AppExtendedModel)
    | ({ kind: 'AGENT' } & AgentExtendedModel);

export default function WorkloadsTable({
    apps,
    agents,
    projectId,
    session,
}: {
    apps: AppExtendedModel[];
    agents: AgentExtendedModel[];
    projectId: string;
    session: UserSession;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const { openDialog } = useDialog();

    const canCreateApps = UserGroupUtils.sessionCanCreateNewAppsForProject(session, projectId);
    const canDeleteApps = UserGroupUtils.sessionCanDeleteAppsForProject(session, projectId);
    const canCreateAgents = UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(session, projectId);
    const canDeleteAgents = UserGroupUtils.sessionCanDeleteAgentsForProject(session, projectId);

    const data: WorkloadRow[] = [
        ...apps.map(app => ({ kind: 'APP' as const, ...app })),
        ...agents.map(agent => ({ kind: 'AGENT' as const, ...agent })),
    ];

    const workloadHref = (item: WorkloadRow) => {
        if (item.kind === 'AGENT') {
            return PathBuilderUtils.projectAgentDrawer(projectId, item.id, 'sandboxes', 'table');
        }

        return PathBuilderUtils.projectAppDrawer(projectId, item.id, 'deployments', 'table');
    };

    return (
        <SimpleDataTable
            columns={[
                ['name', 'Name', true, (item: WorkloadRow) => (
                    <Link href={workloadHref(item)} className="cursor-pointer font-medium hover:underline">
                        {item.name}
                    </Link>
                )],
                ['kind', 'Type', true, (item: WorkloadRow) => (
                    item.kind === 'AGENT' ? 'Agent Sandbox' : 'App'
                )],
                ['status', 'Status', true, (item: WorkloadRow) => (
                    item.kind === 'APP'
                        ? <PodStatusIndicator appId={item.id} />
                        : <span className="text-muted-foreground">{item.warmPoolReplicas} warm</span>
                )],
                ['sourceType', 'Source Type', false],
                ['llmGateway', 'LLM Gateway', false, (item: WorkloadRow) => (
                    item.kind === 'AGENT' ? item.llmGateway.name : ''
                )],
                ['modelAlias', 'Model Aliases', false, (item: WorkloadRow) => (
                    item.kind === 'AGENT' ? item.modelAlias.join(', ') : ''
                )],
                ['createdAt', 'Created At', true, (item: WorkloadRow) => formatDateTime(item.createdAt)],
                ['updatedAt', 'Updated At', false, (item: WorkloadRow) => formatDateTime(item.updatedAt)],
            ]}
            data={data}
            actionCol={item => (
                <div className="flex justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            }
                        />
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            </DropdownMenuGroup>
                            <Link href={workloadHref(item)}>
                                <DropdownMenuItem>
                                    <Eye />
                                    <span>Show {item.kind === 'AGENT' ? 'Agent Sandbox' : 'App'} Details</span>
                                </DropdownMenuItem>
                            </Link>
                            {item.kind === 'APP' ? (
                                <>
                                    {canCreateApps && (
                                        <EditAppDialog projectId={projectId} existingItem={item}>
                                            <DropdownMenuItem>
                                                <Edit2 />
                                                <span>Edit App Name</span>
                                            </DropdownMenuItem>
                                        </EditAppDialog>
                                    )}
                                    {canDeleteApps && (
                                        <DropdownMenuItem
                                            className="text-red-500"
                                            onClick={() => openConfirmDialog({
                                                title: 'Delete App',
                                                description: 'Are you sure you want to delete this app? All data will be lost and this action cannot be undone.',
                                            }).then(result => result ? Toast.fromAction(() => deleteApp(item.id)) : undefined)}
                                        >
                                            <Trash />
                                            <span>Delete App</span>
                                        </DropdownMenuItem>
                                    )}
                                </>
                            ) : (
                                <>
                                    {canCreateAgents && (
                                        <DropdownMenuItem
                                            onClick={() => openDialog(
                                                <RenameAgentDialog agent={item} />,
                                                { maxWidth: 'max-w-md' },
                                            )}
                                        >
                                            <Edit2 />
                                            <span>Rename Agent Sandbox</span>
                                        </DropdownMenuItem>
                                    )}
                                    {canDeleteAgents && (
                                        <DropdownMenuItem
                                            className="text-red-500"
                                            onClick={() => openConfirmDialog({
                                                title: 'Delete Agent Sandbox',
                                                description: 'Are you sure you want to delete this Agent Sandbox? All data will be lost and this action cannot be undone.',
                                            }).then(result => result ? Toast.fromAction(() => deleteAgent(item.id), 'Agent Sandbox deleted successfully') : undefined)}
                                        >
                                            <Trash />
                                            <span>Delete Agent Sandbox</span>
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
            tableIdentifier="workload-list"
        />
    );
}
