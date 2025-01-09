import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import React from "react";
import { BackupInfoModel } from "@/shared/model/backup-info.model";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KubeSizeConverter } from "@/shared/utils/kubernetes-size-converter.utils";
import { formatDateTime } from "@/frontend/utils/format.utils";

export function BackupDetailDialog({
    backupInfo,
    children
}: {
    backupInfo: BackupInfoModel;
    children: React.ReactNode;
}) {

    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={(isO) => {
            setIsOpen(isO);
        }}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Backups</DialogTitle>
                    <DialogDescription>
                        <span className="font-semibold">App:</span> {backupInfo.appName}<br />
                        <span className="font-semibold">Mount Path:</span> {backupInfo.mountPath}<br />
                        For this backup schedule the latest {backupInfo.backupRetention} versions are kept.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                    <Table>
                        <TableCaption>{backupInfo.backups.length} Backups</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Size</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {backupInfo.backups.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{formatDateTime(item.backupDate, true)}</TableCell>
                                    <TableCell>{item.sizeBytes ? KubeSizeConverter.convertBytesToReadableSize(item.sizeBytes) : 'unknown'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
