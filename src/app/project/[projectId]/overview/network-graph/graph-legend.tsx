'use client';

import { cn } from '@/frontend/utils/utils';
import { graphLegendItems, NETWORK_GRAPH_COLORS } from './project-network-graph-visual-semantics';

export function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-xs text-muted-foreground">
      {graphLegendItems.map((item) => (
        <span key={item.kind} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-block w-4 border-t-2',
              item.kind === 'complete' && 'h-0.5 rounded-full border-0',
              item.kind !== 'complete' && 'h-0 border-dashed'
            )}
            style={{
              borderColor:
                item.kind === 'internet'
                  ? NETWORK_GRAPH_COLORS.internet
                  : item.kind === 'external'
                    ? NETWORK_GRAPH_COLORS.external
                    : NETWORK_GRAPH_COLORS.connection,
              background: item.kind === 'complete' ? NETWORK_GRAPH_COLORS.connection : undefined
            }}
          />
          {item.label}
        </span>
      ))}
      <span>Arrows show allowed traffic direction</span>
    </div>
  );
}
