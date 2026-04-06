'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteNodePort } from "./actions";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import NodePortEditDialog from "./node-port-edit-dialog";
import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";

export default function NodePortsCard({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {
    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteNodePort = async (nodePortId: string) => {
        const confirm = await openDialog({
            title: 'Delete Node Port',
            description: 'The node port will be removed and the changes will take effect after you redeploy the app. Are you sure you want to remove this node port?',
            okButton: 'Delete Node Port',
        });
        if (confirm) {
            await Toast.fromAction(() => deleteNodePort(nodePortId));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Node Ports</CardTitle>
                <CardDescription>
                    Expose this app directly on a node/host port, bypassing Traefik. Useful for non-HTTP workloads such as SFTP, game servers, or other TCP/UDP services.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{app.appNodePorts.length} Node Port{app.appNodePorts.length !== 1 ? 's' : ''}</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Container Port</TableHead>
                            <TableHead>Node Port</TableHead>
                            <TableHead>Protocol</TableHead>
                            {!readonly && <TableHead className="w-[100px]">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {app.appNodePorts.map((np) => (
                            <TableRow key={np.id}>
                                <TableCell className="font-medium">{np.port}</TableCell>
                                <TableCell className="font-medium">{np.nodePort}</TableCell>
                                <TableCell className="font-medium">{np.protocol}</TableCell>
                                {!readonly && (
                                    <TableCell className="font-medium flex gap-2">
                                        <NodePortEditDialog appId={app.id} appNodePort={np}>
                                            <Button variant="ghost"><EditIcon /></Button>
                                        </NodePortEditDialog>
                                        <Button variant="ghost" onClick={() => asyncDeleteNodePort(np.id)}>
                                            <TrashIcon />
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && (
                <CardFooter>
                    <NodePortEditDialog appId={app.id}>
                        <Button><Plus /> Add Node Port</Button>
                    </NodePortEditDialog>
                </CardFooter>
            )}
        </Card>
    );
}
