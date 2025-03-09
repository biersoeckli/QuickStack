'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { deletePort, savePort } from "./actions";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { KubeObjectNameUtils } from "@/server/utils/kube-object-name.utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { Code } from "@/components/custom/code";
import { ListUtils } from "@/shared/utils/list.utils";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DefaultPortEditDialog from "./default-port-edit";
import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";

export default function InternalHostnames({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteDomain = async (portId: string) => {
        const confirm = await openDialog({
            title: "Delete Port",
            description: "The port will be removed and the changes will take effect, after you deploy the app. Are you sure you want to remove this port?",
            okButton: "Delete Port"
        });
        if (confirm) {
            await Toast.fromAction(() => deletePort(portId));
        }
    };

    const internalUrl = KubeObjectNameUtils.toServiceName(app.id);

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Internal Ports</CardTitle>
                <CardDescription>If you want to connect other apps to this app, you have to configure the internal ports below.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{app.appPorts.length} Ports</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Port</TableHead>
                            <TableHead className="w-[100px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {app.appPorts.map(port => (
                            <TableRow key={port.id}>
                                <TableCell className="font-medium">
                                    {port.port}
                                </TableCell>
                                {!readonly && <TableCell className="font-medium  flex gap-2">
                                    <DefaultPortEditDialog appId={app.id} appPort={port}>
                                        <Button variant="ghost"><EditIcon /></Button>
                                    </DefaultPortEditDialog>
                                    <Button variant="ghost" onClick={() => asyncDeleteDomain(port.id)}>
                                        <TrashIcon />
                                    </Button>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && <CardFooter>
                <DefaultPortEditDialog appId={app.id}>
                    <Button><Plus /> Add Port</Button>
                </DefaultPortEditDialog>
            </CardFooter>}
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Internal Hostnames</CardTitle>
                <CardDescription>Internal hostnames can be used to connect to this app from other apps in the same project. </CardDescription>
            </CardHeader>
            <CardContent>
                {ListUtils.removeDuplicates([
                    ...app.appPorts.map(p => p.port),
                    ...app.appDomains.map(d => d.port)
                ]).map(port => (
                    <div key={port} className="flex gap-1 pb-2">
                        <div><Code>{internalUrl + ':' + port}</Code></div>
                        <div className="self-center">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild><QuestionMarkCircledIcon /></TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-[350px]">
                                            Other apps can connect to this app using this hostname. This hostname is valid for all internal connections within the same project.<br /><br />
                                            <span className="font-bold">Hostname:</span> {internalUrl}<br />
                                            <span className="font-bold">Port:</span> {port}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card >
    </>;
}