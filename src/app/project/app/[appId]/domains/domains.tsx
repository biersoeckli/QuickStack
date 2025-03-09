'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckIcon, EditIcon, Plus, TrashIcon, XIcon } from "lucide-react";
import DialogEditDialog from "./domain-edit-overlay";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteDomain } from "./actions";
import { Code } from "@/components/custom/code";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { useConfirmDialog } from "@/frontend/states/zustand.states";


export default function DomainsList({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteDomain = async (domainId: string) => {
        const confirm = await openDialog({
            title: "Delete Domain",
            description: "The domain will be removed and the changes will take effect, after you deploy the app. Are you sure you want to remove this domain?",
            okButton: "Delete Domain"
        });
        if (confirm) {
            await Toast.fromAction(() => deleteDomain(domainId));
        }
    };

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Domains</CardTitle>
                <CardDescription>Add custom domains to your application. If your app has a domain configured, it will be public and accessible via the internet.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{app.appDomains.length} Domains</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Port</TableHead>
                            <TableHead>SSL</TableHead>
                            <TableHead>Redirect HTTP to HTTPS</TableHead>
                            <TableHead className="w-[100px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {app.appDomains.map(domain => (
                            <TableRow key={domain.hostname}>
                                <TableCell className="font-medium flex gap-2">
                                    <Code>{domain.hostname}</Code>
                                    <div className="self-center cursor-pointer" onClick={() => window.open((domain.useSsl ? 'https://' : 'http://') + domain.hostname, '_blank')}>
                                        <OpenInNewWindowIcon />
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{domain.port}</TableCell>
                                <TableCell className="font-medium">{domain.useSsl ? <CheckIcon /> : <XIcon />}</TableCell>
                                <TableCell className="font-medium">{domain.useSsl && domain.redirectHttps ? <CheckIcon /> : <XIcon />}</TableCell>
                                {!readonly && <TableCell className="font-medium flex gap-2">
                                    <DialogEditDialog appId={app.id} domain={domain}>
                                        <Button variant="ghost"><EditIcon /></Button>
                                    </DialogEditDialog>
                                    <Button variant="ghost" onClick={() => asyncDeleteDomain(domain.id)}>
                                        <TrashIcon />
                                    </Button>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && <CardFooter>
                <DialogEditDialog appId={app.id}>
                    <Button><Plus /> Add Domain</Button>
                </DialogEditDialog>
            </CardFooter>}
        </Card >

    </>;
}