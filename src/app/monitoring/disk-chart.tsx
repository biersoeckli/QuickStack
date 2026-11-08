'use client';

import { NodeResourceModel } from '@/shared/model/node-resource.model';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import { Progress } from '@/components/ui/progress';

export default function ChartDiskRessources({ nodeRessource }: { nodeRessource: NodeResourceModel }) {
    const { diskUsageAbsolut: used, diskUsageAvailable: available, diskUsageCapacity: capacity } = nodeRessource;

    if (used === undefined || available === undefined || capacity === undefined || capacity <= 0) {
        return <p className="py-6 text-center text-muted-foreground">Storage metrics unavailable</p>;
    }

    return (
        <div className="space-y-3 py-4">
            <div className="flex justify-between text-sm">
                <span>{(used / capacity * 100).toFixed(0)}% used</span>
                <span>{KubeSizeConverter.convertBytesToReadableSize(used)} / {KubeSizeConverter.convertBytesToReadableSize(capacity)}</span>
            </div>
            <Progress value={used / capacity * 100} />
            <p className="text-sm text-muted-foreground">Available: {KubeSizeConverter.convertBytesToReadableSize(available)}</p>
        </div>
    );
}
