'use client';

import { SmoothStepEdge, type EdgeProps } from '@xyflow/react';
import { ProjectNetworkGraphConnectionContextMenu } from './context-menus/project-network-graph-connection-context-menu';

type ConnectionEdgeData = { onDelete?: () => void; internalHostnames: { hostname: string; port: number }[] };

export function ConnectionEdge(props: EdgeProps) {
  const data = props.data as ConnectionEdgeData | undefined;
  if (!data) return <SmoothStepEdge {...props} />;
  return (
    <ProjectNetworkGraphConnectionContextMenu onDelete={data.onDelete} internalHostnames={data.internalHostnames}>
      <SmoothStepEdge {...props} />
    </ProjectNetworkGraphConnectionContextMenu>
  );
}
