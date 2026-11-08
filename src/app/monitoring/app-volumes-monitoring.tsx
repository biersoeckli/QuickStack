'use client';


import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useMemo } from 'react';
import FullLoadingSpinner from '@/components/ui/full-loading-spinnter';
import { AppVolumeMonitoringUsageModel } from '@/shared/model/app-volume-monitoring-usage.model';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress"
import { PathBuilderUtils } from '@/shared/utils/path-builder.utils';
import { AppVolumeIdentityUtils } from '@/shared/utils/app-volume-identity.utils';

export default function AppVolumeMonitoring({
    volumesUsage
}: {
    volumesUsage?: AppVolumeMonitoringUsageModel[]
}) {

    const updatedVolumeUsage = volumesUsage;
    const totals = useMemo(() => {
        const unique = new Map<string, AppVolumeMonitoringUsageModel>();
        for (const volume of volumesUsage ?? []) unique.set(AppVolumeIdentityUtils.observationKey(volume.projectId, volume.pvcName), volume);
        const values = [...unique.values()];
        return {
            used: values.reduce((sum, value) => sum + (value.usedBytes ?? 0), 0),
            capacity: values.reduce((sum, value) => sum + (value.capacityBytes ?? 0), 0),
            incomplete: values.some(value => value.status !== 'available'),
        };
    }, [volumesUsage]);

    if (!updatedVolumeUsage) {
        return <Card>
            <CardHeader>
                <CardTitle>App Volumes Capacity</CardTitle>
            </CardHeader>
            <CardContent>
                <FullLoadingSpinner />
            </CardContent>
        </Card>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>App Volumes Capacity</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{updatedVolumeUsage.length} App Volumes | Total used {KubeSizeConverter.convertBytesToReadableSize(totals.used)} / {KubeSizeConverter.convertBytesToReadableSize(totals.capacity)}{totals.incomplete ? ' (incomplete)' : ''}</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>App</TableHead>
                            <TableHead>Mount Path</TableHead>
                            <TableHead>Capacity</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {updatedVolumeUsage.map((item) => (
                            <TableRow key={`${item.appId}/${item.mountPath}`}>
                                <TableCell>{item.projectName}</TableCell>
                                <TableCell>{item.appName}</TableCell>
                                <TableCell>{item.mountPath}</TableCell>
                                <TableCell className='space-y-1'>
                                    {item.status === 'available' && item.usedBytes !== undefined && item.capacityBytes !== undefined && item.capacityBytes > 0 ? (
                                        <VolumeUsage usedBytes={item.usedBytes} capacityBytes={item.capacityBytes} />
                                    ) : <span>Unavailable ({item.status})</span>}
                                </TableCell>
                                <TableCell>
                                    <Link href={PathBuilderUtils.projectAppDrawer(item.projectId, item.appId, 'settings')} >
                                        <Button variant="ghost" size="sm">
                                            <ExternalLink />
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function VolumeUsage({ usedBytes, capacityBytes }: {
    usedBytes: number;
    capacityBytes: number;
}) {
    const percentage = Math.round(usedBytes / capacityBytes * 100);
    return <>
        <Progress value={percentage} color={percentage >= 90 ? 'red' : percentage >= 80 ? 'orange' : undefined} />
        <div className='text-xs text-slate-500'>
            {KubeSizeConverter.convertBytesToReadableSize(usedBytes)} / {KubeSizeConverter.convertBytesToReadableSize(capacityBytes)}
        </div>
    </>;
}
