'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckIcon, EditIcon, Plus, TrashIcon, XIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { Code } from "@/components/custom/code";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { DomainEditModel } from "@/shared/model/domain-edit.model";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import DomainEditOverlay from "@/components/custom/domain-edit-overlay";
import { deleteDomain } from "@/app/project/actions";

export default function DomainsCard({ domains, workloadId, workloadType, readonly }: {
    domains: DomainEditModel[];
    workloadId: string;
    workloadType: WorkloadType;
    readonly: boolean;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const { openDialog } = useDialog();

    const asyncDeleteDomain = async (domainId: string) => {
        const confirm = await openConfirmDialog({
            title: "Delete Domain",
            description: "The domain will be removed and the changes will take effect, after you deploy the app. Are you sure you want to remove this domain?",
            okButton: "Delete Domain"
        });
        if (confirm) {
            await Toast.fromAction(() => deleteDomain(domainId, workloadType));
        }
    };

    const openEditDomainDialog = async (domain?: DomainEditModel) => {
        const result = await openDialog(<DomainEditOverlay
            existingDomain={domain}
            workloadId={workloadId}
            workloadType={workloadType} />, {
                maxWidth: 'max-w-2xl',
            });
    }

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Domains</CardTitle>
                <CardDescription>Add custom domains. If a domain is configured, it will be public and accessible via the internet.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{domains.length} Domains</TableCaption>
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
                        {domains.map(domain => (
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
                                    <Button variant="ghost" onClick={() => openEditDomainDialog(domain)}><EditIcon /></Button>
                                    <Button variant="ghost" onClick={() => asyncDeleteDomain(domain.id!)}>
                                        <TrashIcon />
                                    </Button>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && <CardFooter>
                <Button onClick={() => openEditDomainDialog()}><Plus /> Add Domain</Button>
            </CardFooter>}
        </Card >

    </>;
}