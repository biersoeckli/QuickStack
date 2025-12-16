'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, Eye, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import React from "react";
import FileMountEditDialog from "./basic-auth-edit-dialog";
import BasicAuthEditDialog from "./basic-auth-edit-dialog";
import { deleteBasicAuth } from "./actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BasicAuth({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDelete = async (volumeId: string) => {
        const confirm = await openDialog({
            title: "Delete Auth Credential",
            description: "Are you sure you want to remove this auth credential? The changes will take effect, after you deploy the app. ",
            okButton: "Delete Auth Credential",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteBasicAuth(volumeId));
        }
    };

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Basic Authentication</CardTitle>
                <CardDescription>Configure basic authentication for your app. This will add a basic authentication layer in front of your app.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{app.appBasicAuths.length} Auth Credentials</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Password</TableHead>
                            <TableHead className="w-[100px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {app.appBasicAuths.map(basicAuth => (
                            <TableRow key={basicAuth.id}>
                                <TableCell className="font-medium">{basicAuth.username}</TableCell>
                                <TableCell className="font-medium">
                                    <TooltipProvider>
                                        <Tooltip delayDuration={300}>
                                            <TooltipTrigger>
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
                                {!readonly && <TableCell className="font-medium flex gap-2">
                                    <BasicAuthEditDialog app={app} basicAuth={basicAuth}>
                                        <Button variant="ghost"><EditIcon /></Button>
                                    </BasicAuthEditDialog>
                                    <Button variant="ghost" onClick={() => asyncDelete(basicAuth.id)}>
                                        <TrashIcon />
                                    </Button>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && <CardFooter>
                <FileMountEditDialog app={app}>
                    <Button>Add Auth Credential</Button>
                </FileMountEditDialog>
            </CardFooter>}
        </Card >
    </>;
}