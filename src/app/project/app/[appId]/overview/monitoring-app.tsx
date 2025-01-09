import { Card, CardContent } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { useEffect, useState } from "react";
import { getRessourceDataApp } from "./actions";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";
import { PodsResourceInfoModel } from "@/shared/model/pods-resource-info.model";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KubeSizeConverter } from "@/shared/utils/kubernetes-size-converter.utils";

export default function MonitoringTab({
    app
}: {
    app: AppExtendedModel;
}) {

    const [selectedPod, setSelectedPod] = useState<PodsResourceInfoModel | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);

    const updateValues = async () => {
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
    }

    useEffect(() => {
        updateValues();
        const intervalId = setInterval(updateValues, 10000);
        return () => clearInterval(intervalId);
    }, [app]);

    return <>
        <Card>
            <CardContent className="pb-0">
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
                                        <Tooltip delayDuration={200}>
                                            <TooltipTrigger asChild>
                                                <div className={'px-3 py-1.5 rounded cursor-pointer'}>{selectedPod?.cpuPercent.toFixed(2)}</div>
                                            </TooltipTrigger>
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
        </Card >
    </>;
}