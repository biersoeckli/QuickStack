'use client';

import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';

export function ProjectNetworkGraphConnectionContextMenu({
    onDelete,
    children,
}: {
    onDelete: () => void;
    children: ReactNode;
}) {
    return (
        <ContextMenu>
            <ContextMenuTrigger render={<g />}>{children}</ContextMenuTrigger>
            <ContextMenuContent onClick={(event) => event.stopPropagation()}>
                <ContextMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 />
                    Delete connection
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
