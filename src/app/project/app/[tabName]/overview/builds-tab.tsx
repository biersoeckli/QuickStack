import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { formatDateTime } from "@/lib/format.utils";
import { AppExtendedModel } from "@/model/app-extended.model";
import { BuildJobModel } from "@/model/build-job";
import { useEffect, useState } from "react";
import { deleteBuild, getBuildsForApp } from "./actions";
import { set } from "date-fns";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";
import { Item } from "@radix-ui/react-dropdown-menu";
import BuildStatusBadge from "./build-status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/lib/zustand.states";
import { Toast } from "@/lib/toast.utils";

export default function BuildsTab({
    app
}: {
    app: AppExtendedModel;
}) {

    const { openDialog } = useConfirmDialog();
    const [appBuilds, setAppBuilds] = useState<BuildJobModel[] | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);

    const updateBuilds = async () => {
        setError(undefined);
        try {
            const response = await getBuildsForApp(app.id);
            if (response.status === 'success' && response.data) {
                setAppBuilds(response.data);
            } else {
                console.error(response);
                setError(response.message ?? 'An unknown error occurred.');
            }
        } catch (ex) {
            console.error(ex);
            setError('An unknown error occurred.');
        }
    }

    const deleteBuildClick = async (buildName: string) => {
        const confirm = await openDialog({
            title: "Delete Build",
            description: "The build will be stopped and removed. Are you sure you want to stop this build?",
            yesButton: "Stop & Remove Build"
        });
        if (confirm) {
            await Toast.fromAction(() => deleteBuild(buildName));
            await updateBuilds();
        }
    }


    useEffect(() => {
        if (app.sourceType === 'container') {
            return;
        }
        updateBuilds();
        const intervalId = setInterval(updateBuilds, 10000);
        return () => clearInterval(intervalId);
    }, [app]);


    if (app.sourceType === 'container') {
        return <></>;
    }

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Container Builds</CardTitle>
                <CardDescription>This is an overview of the last container builds for this App.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!appBuilds ? <FullLoadingSpinner /> :
                    <SimpleDataTable columns={[
                        ['name', 'Name', false],
                        ['status', 'Status', true, (item) => <BuildStatusBadge>{item.status}</BuildStatusBadge>],
                        ["startTime", "Started At", true, (item) => formatDateTime(item.startTime)],
                    ]}
                        data={appBuilds}
                        hideSearchBar={true}
                        actionCol={(item) => {
                            // todo add: <>{ ?}</>
                            return <>
                                <div className="flex gap-4">
                                    <div className="flex-1"></div>
                                    <Button variant="secondary">Show Logs</Button>
                                    {item.status === 'RUNNING' && <Button variant="destructive" onClick={() => deleteBuildClick(item.name)}>Stop Build</Button>}
                                </div>
                            </>
                        }}
                    />
                }
            </CardContent>
        </Card >
    </>;
}
