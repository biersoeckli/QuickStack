'use client';

import type { ReactNode } from 'react';
import { Bot, Globe2, Settings, Trash2 } from 'lucide-react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Toast } from '@/frontend/utils/toast.utils';
import { saveAgentNetworkPolicySettings } from '@/app/project/agent/[agentId]/general/actions';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';

export type ProjectNetworkGraphAgentContextMenuProps = {
    agent: AgentExtendedModel;
    onOpenDrawerTab: (tab: 'sandboxes' | 'configuration') => void;
    onDelete: () => void;
    children: ReactNode;
};

export function ProjectNetworkGraphAgentContextMenu({
    agent,
    onOpenDrawerTab,
    onDelete,
    children,
}: ProjectNetworkGraphAgentContextMenuProps) {
    const allowsInternetAccess = agent.agentNetworkPolicy?.allowInternetAccess !== false;

    return (
        <ContextMenu>
            <ContextMenuTrigger>{children}</ContextMenuTrigger>
            <ContextMenuContent onClick={event => event.stopPropagation()}>
                <ContextMenuItem onClick={() => onOpenDrawerTab('sandboxes')}>
                    <Bot />
                    View Running Sandboxes
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onOpenDrawerTab('configuration')}>
                    <Settings />
                    View Configuration
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    disabled={!allowsInternetAccess}
                    onClick={() => void Toast.fromAction(
                        () => saveAgentNetworkPolicySettings(
                            undefined,
                            { allowInternetAccess: false },
                            agent.id,
                        ),
                        'Egress internet access disabled.',
                    )}
                >
                    <Globe2 />
                    Disable Egress Internet Access
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 />
                    Delete Agent Sandbox
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
