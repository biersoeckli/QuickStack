'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteNodePort } from "./actions";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import NodePortEditDialog from "./node-port-edit-dialog";
import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";

export default function NodePortsCard({ app, readonly, hideCard = false }: {
    app: AppExtendedModel;
    readonly: boolean;
    hideCard?: boolean;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const { openDialog } = useDialog();

    const asyncDeleteNodePort = async (nodePortId: string) => {
        const confirm = await openConfirmDialog({
            title: 'Delete Node Port',
            description: 'The node port will be removed and the changes will take effect after you redeploy the app. Are you sure you want to remove this node port?',
            okButton: 'Delete Node Port',
        });
        if (confirm) {
            await Toast.fromAction(() => deleteNodePort(nodePortId));
        }
    };
    const CardWrapper = hideCard ? 'div' : Card;

    return (
        <CardWrapper>
             <CardHeader>
                <CardTitle>Node Ports</CardTitle>
                <CardDescription>
                    Expose this app directly on a node/host port, bypassing Traefik. Useful for non-HTTP workloads such as SFTP, game servers, or other TCP/UDP services.
                </CardDescription>
            </CardHeader>
            {app.appNodePorts.length > 0 && <CardContent className={hideCard ? "px-0" : undefined}>
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
                                        <Button
                                            variant="ghost"
                                            onClick={() => void openDialog(
                                                <NodePortEditDialog
                                                    appId={app.id}
                                                    appNodePort={np}
                                                />,
                                                { maxWidth: '425px' },
                                            )}
                                        >
                                            <EditIcon />
                                        </Button>
                                        <Button variant="ghost" onClick={() => asyncDeleteNodePort(np.id)}>
                                            <TrashIcon />
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>}
            {!readonly && (
                <CardFooter className={hideCard ? "px-0" : undefined}>
                    <Button
                        onClick={() => void openDialog(
                            <NodePortEditDialog appId={app.id} />,
                            { maxWidth: '425px' },
                        )}
                    >
                        <Plus /> Add Node Port
                    </Button>
                </CardFooter>
            )}
        </CardWrapper>
    );
}
