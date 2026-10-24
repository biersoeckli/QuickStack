'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Bot, Globe2, Settings, Trash2 } from 'lucide-react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Toast } from '@/frontend/utils/toast.utils';
import { saveAgentNetworkPolicySettings } from '@/app/project/[projectId]/agent-components/agent-drawer-components/configuration/actions';
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
    const internetAccessEnabled = agent.agentNetworkPolicy?.allowInternetAccess !== false;
    const [allowsInternetAccess, setAllowsInternetAccess] = useState(internetAccessEnabled);

    useEffect(() => {
        setAllowsInternetAccess(internetAccessEnabled);
    }, [internetAccessEnabled]);

    const toggleInternetAccess = async () => {
        const nextAllowsInternetAccess = !allowsInternetAccess;
        setAllowsInternetAccess(nextAllowsInternetAccess);
        try {
            await Toast.fromAction(
                () => saveAgentNetworkPolicySettings(
                    undefined,
                    { allowInternetAccess: nextAllowsInternetAccess },
                    agent.id,
                ),
                `Egress internet access ${nextAllowsInternetAccess ? 'enabled' : 'disabled'}.`,
            );
        } catch {
            setAllowsInternetAccess(!nextAllowsInternetAccess);
        }
    };

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
                    onClick={() => void toggleInternetAccess()}
                >
                    <Globe2 />
                    {allowsInternetAccess ? 'Disable' : 'Enable'} Egress Internet Access
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
