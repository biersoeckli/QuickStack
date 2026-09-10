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

type AppVolumeMonitoringUsageExtendedModel = AppVolumeMonitoringUsageModel & {
    usedPercentage: number;
};

function convertToExtendedModel(input?: AppVolumeMonitoringUsageModel[]): AppVolumeMonitoringUsageExtendedModel[] | undefined {
    if (input) {
        return input.map(item => ({
            ...item,
            usedPercentage: Math.round(item.usedBytes / item.capacityBytes * 100)
        }));
    }
    return undefined;
}

export default function AppVolumeMonitoring({
    volumesUsage
}: {
    volumesUsage?: AppVolumeMonitoringUsageModel[]
}) {

    const updatedVolumeUsage = useMemo(() => convertToExtendedModel(volumesUsage), [volumesUsage]);

    const { totalUsedBytes, totalCapacityBytes } = useMemo(() => {
        if (!updatedVolumeUsage) {
            return { totalUsedBytes: undefined, totalCapacityBytes: undefined };
        }
        return {
            totalUsedBytes: updatedVolumeUsage.reduce((acc, item) => acc + item.usedBytes, 0),
            totalCapacityBytes: updatedVolumeUsage.reduce((acc, item) => acc + item.capacityBytes, 0),
        };
    }, [updatedVolumeUsage]);

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
                    <TableCaption>{updatedVolumeUsage.length} App Volumes {totalUsedBytes && totalCapacityBytes && <>
                        <span className='text-slate-500'> | Total used {KubeSizeConverter.convertBytesToReadableSize(totalUsedBytes)} | Total allocated {KubeSizeConverter.convertBytesToReadableSize(totalCapacityBytes)}</span>
                    </>}
                    </TableCaption>
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
                            <TableRow key={item.appId}>
                                <TableCell>{item.projectName}</TableCell>
                                <TableCell>{item.appName}</TableCell>
                                <TableCell>{item.mountPath}</TableCell>
                                <TableCell className='space-y-1'>
                                    <Progress value={item.usedPercentage}
                                        color={item.usedPercentage >= 90 ? 'red' : (item.usedPercentage >= 80 ? 'orange' : undefined)} />
                                    <div className='text-xs text-slate-500'>{KubeSizeConverter.convertBytesToReadableSize(item.usedBytes)} / {KubeSizeConverter.convertBytesToReadableSize(item.capacityBytes)}</div>
                                </TableCell>
                                <TableCell>
                                    <Link href={`/project/app/${item.appId}?tabName=storage`} >
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
