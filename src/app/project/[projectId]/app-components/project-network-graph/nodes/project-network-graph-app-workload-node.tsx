import { memo } from 'react';
import { Boxes, Database } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import PodStatusIndicator from '@/components/custom/pod-status-indicator';
import BuildStatusIndicator from '@/components/custom/build-status-indicator';
import { cn } from '@/frontend/utils/utils';
import type { ProjectNetworkGraphAppContextMenuProps } from '../context-menus/project-network-graph-app-context-menu';
import { ProjectNetworkGraphAppContextMenu } from '../context-menus/project-network-graph-app-context-menu';
import type { NetworkGraphNode } from '../project-network-graph-projection';

const hiddenHandleClassName = 'size-1.5! border-0! bg-transparent! opacity-0! pointer-events-none';
const connectionSourceHandleClassName = 'z-20! size-4! border-2! border-background! bg-qs-500! opacity-0! shadow-md! transition-all duration-150 group-hover:opacity-100! [&.connectingfrom]:opacity-0! hover:bg-qs-600!';
const connectionTargetHandleClassName = 'z-20! size-4! border-2! border-background! bg-qs-400! opacity-0! shadow-md! transition-all duration-150 [&.connectingto]:opacity-100! hover:bg-qs-500!';

type AppWorkloadNodeData = NetworkGraphNode & {
    connectionInProgress?: boolean;
    connectionTarget?: boolean;
    selected?: boolean;
    connectedToSelection?: boolean;
    appContextMenu?: Omit<ProjectNetworkGraphAppContextMenuProps, 'children'>;
};

export const ProjectNetworkGraphAppWorkloadNode = memo(function ProjectNetworkGraphAppWorkloadNode({
    data,
}: NodeProps<Node<AppWorkloadNodeData, 'app-workload'>>) {
    const database = !!data.appType && data.appType.toUpperCase() !== 'APP';
    const Icon = database ? Database : Boxes;
    const node = (
        <div className={cn('group relative w-[240px] cursor-pointer transition-opacity duration-150', !data.selected && !data.connectedToSelection && 'opacity-40')}>
            <div className={cn(
                'relative z-10 flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-xs transition-all duration-150 hover:border-qs-500/50 hover:shadow-md',
                data.external && 'border-dashed border-amber-500/70 bg-amber-500/5',
                data.selected && 'border-qs-500 ring-2 ring-qs-500/20 shadow-md',
            )}>
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg ring-1', database ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30' : 'bg-qs-500/10 text-qs-600 ring-qs-500/30')}>
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-semibold" title={data.name}>{data.name}</p>
                        <div className={cn('ml-auto flex shrink-0 transition-opacity', data.connectionTarget && 'opacity-0')}>
                            <PodStatusIndicator appId={data.id.replace('APP:', '')} />
                        </div>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{data.caption ?? (database ? data.appType : 'App')}</p>
                </div>
            </div>
            <div className="relative z-0 mx-auto -mt-px hidden w-[184px] justify-center rounded-b-xl border border-t-0 bg-card px-3 pb-2 pt-2 shadow-xs has-[.build-status-indicator]:flex">
                <BuildStatusIndicator appId={data.id.replace('APP:', '')} showLabel className="build-status-indicator" />
            </div>
            <Handle id="target-ingress" type="target" position={Position.Left} title="Drop connection here" className={cn(data.external ? hiddenHandleClassName : connectionTargetHandleClassName, data.connectionTarget && 'opacity-100!')} style={{ top: 34, bottom: 'auto' }} />
            <Handle id="source-internet" type="source" position={Position.Top} className={hiddenHandleClassName} />
            <Handle id="source-ingress" type="source" position={Position.Bottom} className={hiddenHandleClassName} />
            <Handle id="target-egress" type="target" position={Position.Left} className={hiddenHandleClassName} />
            <Handle id="source-egress" type="source" position={Position.Right} title="Drag to create connection" className={cn(data.external ? hiddenHandleClassName : connectionSourceHandleClassName, data.connectionInProgress && 'opacity-0!')} style={{ top: 34, bottom: 'auto' }} />
        </div>
    );

    return data.appContextMenu
        ? <ProjectNetworkGraphAppContextMenu {...data.appContextMenu}>{node}</ProjectNetworkGraphAppContextMenu>
        : node;
});
