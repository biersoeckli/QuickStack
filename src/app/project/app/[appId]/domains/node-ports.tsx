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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
                            {!readonly && <TableHead className="w-[88px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {app.appNodePorts.map((np) => (
                            <TableRow key={np.id} className="group transition-colors duration-150 hover:bg-muted/30">
                                <TableCell className="font-medium">{np.port}</TableCell>
                                <TableCell className="font-medium">{np.nodePort}</TableCell>
                                <TableCell className="font-medium">{np.protocol}</TableCell>
                                {!readonly && (
                                    <TableCell className="w-[88px] font-medium">
                                        <div className="flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => void openDialog(<NodePortEditDialog appId={app.id} appNodePort={np} />, { maxWidth: '425px' })}><EditIcon /></Button>} />
                                                    <TooltipContent>Edit node port</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger render={<Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => asyncDeleteNodePort(np.id)}><TrashIcon /></Button>} />
                                                    <TooltipContent>Delete node port</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
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
