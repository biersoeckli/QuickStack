'use client';

import type { ReactNode } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';

export function ProjectNetworkGraphConnectionContextMenu({
    onDelete,
    internalHostnames,
    children,
}: {
    onDelete?: () => void;
    internalHostnames: { hostname: string; port: number }[];
    children: ReactNode;
}) {
    return (
        <ContextMenu>
            <ContextMenuTrigger render={<g />}>{children}</ContextMenuTrigger>
            <ContextMenuContent onClick={(event) => event.stopPropagation()}>
                {internalHostnames.map(({ hostname, port }) => (
                    <ContextMenuItem key={hostname} onClick={() => {
                        void navigator.clipboard.writeText(hostname);
                        toast.success(`Internal hostname for port ${port} copied`);
                    }}>
                        <Copy />
                        Copy internal hostname ({port})
                    </ContextMenuItem>
                ))}
                {onDelete && internalHostnames.length > 0 && <ContextMenuSeparator />}
                {onDelete && <ContextMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 />
                    Delete connection
                </ContextMenuItem>}
            </ContextMenuContent>
        </ContextMenu>
    );
}
