'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, Eye, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import React from "react";
import BasicAuthEditDialog from "./basic-auth-edit-dialog";
import { deleteBasicAuth } from "./actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BasicAuth({ app, readonly, hideCard = false }: {
    app: AppExtendedModel;
    readonly: boolean;
    hideCard?: boolean;
}) {

    const { openConfirmDialog } = useConfirmDialog();
    const { openDialog } = useDialog();

    const asyncDelete = async (volumeId: string) => {
        const confirm = await openConfirmDialog({
            title: "Delete Auth Credential",
            description: "Are you sure you want to remove this auth credential? The changes will take effect, after you deploy the app. ",
            okButton: "Delete Auth Credential",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteBasicAuth(volumeId));
        }
    };
    const CardWrapper = hideCard ? 'div' : Card;

    return <>
        <CardWrapper>
            <CardHeader>
                <CardTitle>Basic Authentication</CardTitle>
                <CardDescription>Configure basic authentication for your app. This will add a basic authentication layer in front of your app.</CardDescription>
            </CardHeader>
            {app.appBasicAuths.length > 0 && <CardContent className={hideCard ? "px-0" : undefined}>
                <Table>
                    <TableCaption>{app.appBasicAuths.length} Auth Credentials</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Password</TableHead>
                            {!readonly && <TableHead className="w-[88px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {app.appBasicAuths.map(basicAuth => (
                            <TableRow key={basicAuth.id} className="group transition-colors duration-150 hover:bg-muted/30">
                                <TableCell className="font-medium">{basicAuth.username}</TableCell>
                                <TableCell className="font-medium">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger delay={300}>
                                                <Button variant="ghost">
                                                    <Eye />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{basicAuth.password}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                                {!readonly && <TableCell className="w-[88px] font-medium">
                                    <div className="flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                    <Button size="icon"
                                        variant="ghost"
                                        onClick={() => void openDialog(
                                            <BasicAuthEditDialog
                                                app={app}
                                                basicAuth={basicAuth}
                                            />,
                                            { maxWidth: '425px' },
                                        )}
                                    >
                                        <EditIcon />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => asyncDelete(basicAuth.id)}>
                                        <TrashIcon />
                                    </Button>
                                    </div>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>}
            {!readonly && <CardFooter className={hideCard ? "px-0" : undefined}>
                <Button
                    onClick={() => void openDialog(
                        <BasicAuthEditDialog app={app} />,
                        { maxWidth: '425px' },
                    )}
                >
                    Add Auth Credential
                </Button>
            </CardFooter>}
        </CardWrapper>
    </>;
}
