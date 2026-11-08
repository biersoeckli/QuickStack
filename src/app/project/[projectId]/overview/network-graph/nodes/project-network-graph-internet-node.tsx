import { memo } from 'react';
import { Cloud } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@/frontend/utils/utils';
import type { NetworkGraphNode } from '../project-network-graph-projection';

const hiddenHandleClassName = 'size-1.5! border-0! bg-transparent! opacity-0! pointer-events-none';

type InternetNodeData = NetworkGraphNode & {
    selected?: boolean;
    connectedToSelection?: boolean;
};

export const ProjectNetworkGraphInternetNode = memo(function ProjectNetworkGraphInternetNode({
    data,
}: NodeProps<Node<InternetNodeData, 'internet'>>) {
    return (
        <div className={cn('flex flex-col items-center gap-1.5 transition-opacity duration-150', !data.selected && !data.connectedToSelection && 'opacity-40')}>
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-violet-400 bg-card text-violet-500 shadow-xs">
                <Cloud className="size-7" />
            </div>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Internet</span>
            <Handle id="target" type="target" position={Position.Bottom} className={hiddenHandleClassName} style={{ left: '35%' }} />
            <Handle id="source" type="source" position={Position.Bottom} className={hiddenHandleClassName} style={{ left: '65%' }} />
        </div>
    );
});
