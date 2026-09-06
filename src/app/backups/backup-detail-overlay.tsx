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
import { deleteBackup, downloadBackup } from "./actions";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";

export function BackupDetailDialog({
    backupInfo,
    children
}: {
    backupInfo: BackupInfoModel;
    children: React.ReactNode;
}) {

    const { openConfirmDialog } = useConfirmDialog();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [backups, setBackups] = React.useState(backupInfo.backups);

    React.useEffect(() => {
        setBackups(backupInfo.backups);
    }, [backupInfo.backups]);

    const asyncDownloadPvcData = async (s3Key: string) => {
        try {
            setIsLoading(true);
            await Toast.fromAction(() => downloadBackup(backupInfo.s3TargetId, s3Key)).then(x => {
                if (x.status === 'success' && x.data) {
                    window.open('/api/volume-data-download?fileName=' + x.data);
                }
            });
        } finally {
            setIsLoading(false);
        }
    }

    const asyncDeleteBackup = async (s3Key: string) => {
        if (await openConfirmDialog({
            title: 'Delete Backup',
            description: 'This action deletes the backup from the storage. This action cannot be undone.',
            okButton: 'Delete'
        })) {
            try {
                setIsLoading(true);
                const result = await Toast.fromAction(() => deleteBackup(backupInfo.s3TargetId, s3Key));
                if (result.status === 'success') {
                    setBackups((currentBackups) => currentBackups.filter((backup) => backup.key !== s3Key));
                }
            } finally {
                setIsLoading(false);
            }
        }
    }

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
                        <TableCaption>{backups.length} Backups</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {backups.map((item) => (
                                <TableRow key={item.key}>
                                    <TableCell>{formatDateTime(item.backupDate, true)}</TableCell>
                                    <TableCell>{item.sizeBytes ? KubeSizeConverter.convertBytesToReadableSize(item.sizeBytes) : 'unknown'}</TableCell>
                                    <TableCell className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => asyncDownloadPvcData(item.key)} disabled={isLoading}>
                                            <Download />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => asyncDeleteBackup(item.key)} disabled={isLoading}>
                                            <Trash2 />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
