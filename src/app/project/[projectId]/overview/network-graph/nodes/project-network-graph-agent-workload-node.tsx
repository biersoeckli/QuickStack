import { memo } from 'react';
import { Bot } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@/frontend/utils/utils';
import type { ProjectNetworkGraphAgentContextMenuProps } from '../context-menus/project-network-graph-agent-context-menu';
import { ProjectNetworkGraphAgentContextMenu } from '../context-menus/project-network-graph-agent-context-menu';
import type { NetworkGraphNode } from '../project-network-graph-projection';

const hiddenHandleClassName = 'size-1.5! border-0! bg-transparent! opacity-0! pointer-events-none';
const connectionSourceHandleClassName = 'z-20! size-4! border-2! border-background! bg-qs-500! opacity-0! shadow-md! transition-all duration-150 group-hover:opacity-100! [&.connectingfrom]:opacity-0! hover:bg-qs-600!';

type AgentWorkloadNodeData = NetworkGraphNode & {
    connectionInProgress?: boolean;
    selected?: boolean;
    connectedToSelection?: boolean;
    agentContextMenu?: Omit<ProjectNetworkGraphAgentContextMenuProps, 'children'>;
};

export const ProjectNetworkGraphAgentWorkloadNode = memo(function ProjectNetworkGraphAgentWorkloadNode({
    data,
}: NodeProps<Node<AgentWorkloadNodeData, 'agent-workload'>>) {
    const node = (
        <div className={cn('group relative w-[240px] cursor-pointer transition-opacity duration-150', !data.selected && !data.connectedToSelection && 'opacity-40')}>
            <div className={cn(
                'relative z-10 flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-xs transition-all duration-150 hover:border-qs-500/50 hover:shadow-md',
                data.external && 'border-dashed border-amber-500/70 bg-amber-500/5',
                data.selected && 'border-qs-500 ring-2 ring-qs-500/20 shadow-md',
            )}>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30">
                    <Bot className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={data.name}>{data.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{data.caption ?? 'Agent sandbox'}</p>
                </div>
            </div>
            <Handle id="target-ingress" type="target" position={Position.Left} className={hiddenHandleClassName} style={{ top: 34, bottom: 'auto' }} />
            <Handle id="source-internet" type="source" position={Position.Top} className={hiddenHandleClassName} />
            <Handle id="source-ingress" type="source" position={Position.Bottom} className={hiddenHandleClassName} />
            <Handle id="target-egress" type="target" position={Position.Left} className={hiddenHandleClassName} />
            <Handle id="source-egress" type="source" position={Position.Right} title="Drag to create connection" className={cn(data.external ? hiddenHandleClassName : connectionSourceHandleClassName, data.connectionInProgress && 'opacity-0!')} style={{ top: 34, bottom: 'auto' }} />
        </div>
    );

    return data.agentContextMenu
        ? <ProjectNetworkGraphAgentContextMenu {...data.agentContextMenu}>{node}</ProjectNetworkGraphAgentContextMenu>
        : node;
});
