'use client';

import type { ReactNode } from 'react';
import { Blocks, Bot, Database, File } from 'lucide-react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useDialog } from '@/frontend/states/zustand.states';
import { EditAppDialog } from '@/app/project/[projectId]/app-components/edit-app-dialog';
import { CreateAgentDialog } from '@/app/project/[projectId]/agent-components/create-agent-dialog';
import ChooseTemplateDialog from '@/app/project/[projectId]/choose-template-dialog';

type ProjectNetworkGraphCanvasContextMenuProps = {
    projectId: string;
    canCreateApps: boolean;
    canCreateAgents: boolean;
    children: ReactNode;
};

export function ProjectNetworkGraphCanvasContextMenu({
    projectId,
    canCreateApps,
    canCreateAgents,
    children,
}: ProjectNetworkGraphCanvasContextMenuProps) {
    const { openDialog } = useDialog();
    const openTemplateDialog = (templateType: 'database' | 'template' | 'agent-template') => {
        openDialog(<ChooseTemplateDialog projectId={projectId} templateType={templateType} />, { maxWidth: '1000px' });
    };

    if (!canCreateApps && !canCreateAgents) return children;

    return (
        <ContextMenu>
            <ContextMenuTrigger className="block size-full">
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent>
                {canCreateApps && <>
                    <ContextMenuSub>
                        <ContextMenuSubTrigger className="gap-2">
                            <File />
                            Create App
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                            <EditAppDialog projectId={projectId} openAppAfterCreate={false}>
                                <ContextMenuItem>
                                    <File />
                                    Empty App
                                </ContextMenuItem>
                            </EditAppDialog>
                            <ContextMenuItem onClick={() => openTemplateDialog('template')}>
                                <Blocks />
                                App from Template
                            </ContextMenuItem>
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuItem onClick={() => openTemplateDialog('database')}>
                        <Database />
                        Create Database
                    </ContextMenuItem>
                </>}
                {canCreateAgents && <ContextMenuSub>
                    <ContextMenuSubTrigger className="gap-2">
                        <Bot />
                        Create Agent Sandbox
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <CreateAgentDialog projectId={projectId}>
                            <ContextMenuItem>
                                <Bot />
                                Empty Agent Sandbox
                            </ContextMenuItem>
                        </CreateAgentDialog>
                        <ContextMenuItem onClick={() => openTemplateDialog('agent-template')}>
                            <Blocks />
                            Agent Sandbox from Template
                        </ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>}
            </ContextMenuContent>
        </ContextMenu>
    );
}
