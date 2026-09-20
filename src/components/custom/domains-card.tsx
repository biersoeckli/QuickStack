'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckIcon, EditIcon, ExternalLink, Plus, TrashIcon, XIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { Code } from "@/components/custom/code";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { DomainEditModel } from "@/shared/model/domain-edit.model";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import DomainEditOverlay from "@/components/custom/domain-edit-overlay";
import { deleteDomain } from "@/app/project/actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function DomainsCard({ domains, workloadId, workloadType, readonly, hideCard = false }: {
    domains: DomainEditModel[];
    workloadId: string;
    workloadType: WorkloadType;
    readonly: boolean;
    hideCard?: boolean;
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
        await openDialog(<DomainEditOverlay
            existingDomain={domain}
            workloadId={workloadId}
            workloadType={workloadType} />, {
            maxWidth: 'max-w-2xl',
        });
    }
    const CardWrapper = hideCard ? 'div' : Card;

    return <>
        <CardWrapper>
            <CardHeader>
                <CardTitle>Domains</CardTitle>
                <CardDescription>Add custom domains. If a domain is configured, it will be public and accessible via the internet.
                </CardDescription>
            </CardHeader>
            {domains.length > 0 && <CardContent className={hideCard ? "px-0" : undefined}>
                <Table>
                    <TableCaption>{domains.length} Domains</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            {!hideCard && <>
                                <TableHead>Port</TableHead>
                                <TableHead>SSL</TableHead>
                                <TableHead>Redirect HTTP to HTTPS</TableHead>
                            </>}
                            {!readonly && <TableHead className="w-[88px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {domains.map(domain => (
                            <TableRow key={domain.hostname} className="group transition-colors duration-150 hover:bg-muted/30">
                                <TableCell className="font-medium flex gap-2">
                                    <Code>{domain.hostname}</Code>
                                    <div className="self-center cursor-pointer" onClick={() => window.open((domain.useSsl ? 'https://' : 'http://') + domain.hostname, '_blank')}>
                                        <ExternalLink className="h-3 w-3" />
                                    </div>
                                </TableCell>
                                {!hideCard && <>
                                    <TableCell className="font-medium">{domain.port}</TableCell>
                                    <TableCell className="font-medium">{domain.useSsl ? <CheckIcon /> : <XIcon />}</TableCell>
                                    <TableCell className="font-medium">{domain.useSsl && domain.redirectHttps ? <CheckIcon /> : <XIcon />}</TableCell>
                                </>}
                                {!readonly && <TableCell className="w-[88px] font-medium">
                                    <div className="flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => openEditDomainDialog(domain)}><EditIcon /></Button>} />
                                                <TooltipContent>Edit domain</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger render={<Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => asyncDeleteDomain(domain.id!)}><TrashIcon /></Button>} />
                                                <TooltipContent>Delete domain</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>}
            {!readonly && <CardFooter className={hideCard ? "px-0" : undefined}>
                <Button variant="outline" onClick={() => openEditDomainDialog()}><Plus /> Add Domain</Button>
            </CardFooter>}
        </CardWrapper >

    </>;
}
