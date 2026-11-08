import { CardContent } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { useCallback, useState } from "react";
import { getRessourceDataApp } from "../deployments/actions";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";
import { usePolling } from "@/frontend/hooks/use-polling";
import { PodsResourceInfoModel } from "@/shared/model/pods-resource-info.model";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KubeSizeConverter } from "@/shared/utils/kubernetes-size-converter.utils";
import { cn } from "@/frontend/utils/utils";

export default function MonitoringTab({
    app,
}: {
    app: AppExtendedModel;
}) {

    const [selectedPod, setSelectedPod] = useState<PodsResourceInfoModel | undefined>(undefined);
    const [, setError] = useState<string | undefined>(undefined);

    const updateValues = useCallback(async () => {
        setError(undefined);
        try {
            const response = await getRessourceDataApp(app.projectId, app.id);
            if (response.status === 'success' && response.data) {
                setSelectedPod(response.data);

            } else {
                console.error(response);
                setError(response.message ?? 'An unknown error occurred.');
            }
        } catch (ex) {
            console.error(ex);
            setError('An unknown error occurred.');
        }
    }, [app.id, app.projectId])

    usePolling(updateValues, { intervalMs: 10000, runImmediately: true });

    return <>
            <CardContent className={cn('space-y-4', 'p-0')}>
                {!selectedPod ? <FullLoadingSpinner /> :
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>CPU %</TableHead>
                                <TableHead>RAM</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger delay={200} render={<div className={'px-3 py-1.5 rounded cursor-pointer'}>{selectedPod?.cpuPercent.toFixed(2)}</div>} />
                                            <TooltipContent>
                                                <p className="max-w-[350px]">{selectedPod?.cpuAbsolutCores.toFixed(10)} cores</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                                <TableCell className="font-medium">{KubeSizeConverter.convertBytesToReadableSize(selectedPod?.ramAbsolutBytes)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                }
            </CardContent>
    </>;
}
