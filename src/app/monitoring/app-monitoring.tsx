'use client';


import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { Actions } from '@/frontend/utils/nextjs-actions.utils';
import { getMonitoringForAllApps, getVolumeMonitoringUsage } from './actions';
import { toast } from 'sonner';
import FullLoadingSpinner from '@/components/ui/full-loading-spinnter';
import { AppVolumeMonitoringUsageModel } from '@/shared/model/app-volume-monitoring-usage.model';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress"
import dataAccess from '@/server/adapter/db.client';
import { ProgressIndicator } from '@radix-ui/react-progress';
import { AppMonitoringUsageModel } from '@/shared/model/app-monitoring-usage.model';

export default function AppRessourceMonitoring({
    appsRessourceUsage
}: {
    appsRessourceUsage?: AppMonitoringUsageModel[]
}) {


    const [updatedAppUsage, setUpdatedAppUsage] = useState<AppMonitoringUsageModel[] | undefined>(appsRessourceUsage);

    const fetchMonitoringData = async () => {
        try {
            const data = await Actions.run(() => getMonitoringForAllApps());
            setUpdatedAppUsage(data);
        } catch (ex) {
            toast.error('An error occurred while fetching current volume usage');
            console.error('An error occurred while fetching volume nodes', ex);
        }
    }

    useEffect(() => {
        const intervalId = setInterval(() => fetchMonitoringData(), 10000);
        return () => {
            clearInterval(intervalId);
        }
    }, [appsRessourceUsage]);

    if (!updatedAppUsage) {
        return <Card>
            <CardContent>
                <FullLoadingSpinner />
            </CardContent>
        </Card>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>App Ressource Usage</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{updatedAppUsage.length} Apps</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>App</TableHead>
                            <TableHead>CPU</TableHead>
                            <TableHead>RAM</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {updatedAppUsage.map((item, index) => (
                            <TableRow key={item.appId}>
                                <TableCell>{item.projectName}</TableCell>
                                <TableCell>{item.appName}</TableCell>
                                <TableCell>
                                    <span className='font-semibold'>{item.cpuUsagePercent.toFixed(3)}%</span> / {item.cpuUsage.toFixed(5)} Cores
                                </TableCell>
                                <TableCell>{KubeSizeConverter.convertBytesToReadableSize(item.ramUsageBytes)}</TableCell>
                                <TableCell>
                                    <Link href={`/project/app/${item.appId}`} >
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
