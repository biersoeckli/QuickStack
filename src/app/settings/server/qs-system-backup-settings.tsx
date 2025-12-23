'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listSystemBackups, runSystemBackupNow, setSystemBackupLocation, uploadAndRestoreSystemBackup, downloadSystemBackup } from "./actions";
import { S3Target } from "@prisma/client";
import { SystemBackupLocationSettingsModel, systemBackupLocationSettingsZodModel } from "@/shared/model/system-backup-location-settings.model";
import SelectFormField from "@/components/custom/select-form-field";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileArchive, Loader2, Play, Upload, Download, AlertTriangle } from "lucide-react";
import { formatBytes, formatDate, formatDateTime } from "@/frontend/utils/format.utils";
import { Toast } from "@/frontend/utils/toast.utils";
import { Constants } from "@/shared/utils/constants";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirmDialog } from "@/frontend/states/zustand.states";

const DEACTIVATED_VALUE = Constants.QS_SYSTEM_BACKUP_DEACTIVATED;

export default function QuickStackSystemBackupSettings({
    systemBackupLocation,
    s3Targets
}: {
    systemBackupLocation: string;
    s3Targets: S3Target[];
}) {
    const [showBackupsDialog, setShowBackupsDialog] = useState(false);
    const [backups, setBackups] = useState<any[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [runningBackup, setRunningBackup] = useState(false);
    const [uploadingBackup, setUploadingBackup] = useState(false);
    const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null);
    const confirmDialog = useConfirmDialog();

    const form = useForm<SystemBackupLocationSettingsModel>({
        resolver: zodResolver(systemBackupLocationSettingsZodModel),
        defaultValues: {
            systemBackupLocation: systemBackupLocation || DEACTIVATED_VALUE,
        }
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>,
        payload: SystemBackupLocationSettingsModel) =>
        setSystemBackupLocation(state, payload),
        FormUtils.getInitialFormState<typeof systemBackupLocationSettingsZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('System backup settings updated successfully.');
        }
        FormUtils.mapValidationErrorsToForm<typeof systemBackupLocationSettingsZodModel>(state, form)
    }, [state]);

    const handleViewBackups = async () => {
        setShowBackupsDialog(true);
        setLoadingBackups(true);
        try {
            const result = await listSystemBackups();
            if (result.status === 'success') {
                setBackups(result.data || []);
            } else {
                toast.error(result.message || 'Failed to load backups');
            }
        } catch (error) {
            toast.error('Failed to load backups');
        } finally {
            setLoadingBackups(false);
        }
    };

    const handleRunBackup = async () => {
        setRunningBackup(true);
        try {
            await Toast.fromAction(() => runSystemBackupNow());
        } finally {
            setRunningBackup(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const confirmed = await confirmDialog.openConfirmDialog({
            title: 'Restore System Backup',
            description: 'This will replace your current database with the one from the backup file. This action cannot be undone. Make sure you have a recent backup before proceeding. You will need to restart QuickStack after restoration.',
            okButton: 'Restore Backup',
            cancelButton: 'Cancel'
        });

        if (!confirmed) {
            event.target.value = ''; // Reset file input
            return;
        }

        setUploadingBackup(true);
        try {
            const formData = new FormData();
            formData.append('backupFile', file);

            const result = await uploadAndRestoreSystemBackup(formData);

            if (result.status === 'success') {
                toast.success(result.message || 'Backup restored successfully. Please restart QuickStack.');
                setShowBackupsDialog(false);
            } else {
                toast.error(result.message || 'Failed to restore backup');
            }
        } catch (error) {
            toast.error('Failed to restore backup');
        } finally {
            setUploadingBackup(false);
            event.target.value = ''; // Reset file input
        }
    };

    const handleDownloadBackup = async (backupKey: string) => {
        setDownloadingBackup(backupKey);
        try {
            await Toast.fromAction(() => downloadSystemBackup(backupKey)).then(x => {
                if (x.status === 'success' && x.data) {
                    window.open('/api/volume-data-download?fileName=' + x.data);
                }
            });
        } finally {
            setDownloadingBackup(null);
        }
    };

    return <>
        <Card>
            <CardHeader>
                <CardTitle>System Backup Location</CardTitle>
                <CardDescription>
                    Configure where QuickStack system files should be backed up (App configurations, QuickStack settings...).
                    Select an S3 storage target to enable automatic system backups, or deactivate to disable system backups.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-4">

                        <SelectFormField
                            form={form}
                            name="systemBackupLocation"
                            label="System Backup Location"
                            formDescription={<>
                                S3 Storage Locations can be configured <span className="underline"><Link href="/settings/s3-targets">here</Link></span>.
                            </>}
                            values={[
                                [DEACTIVATED_VALUE, Constants.QS_SYSTEM_BACKUP_DEACTIVATED],
                                ...s3Targets.map((target) =>
                                    [target.id, `S3: ${target.name}`])
                            ] as [string, string][]}
                        />

                        <div className="flex gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleViewBackups}
                                disabled={systemBackupLocation === DEACTIVATED_VALUE || !systemBackupLocation}
                            >
                                <FileArchive className="mr-2 h-4 w-4" />
                                View Backups
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleRunBackup}
                                disabled={systemBackupLocation === DEACTIVATED_VALUE || !systemBackupLocation || runningBackup}
                            >
                                {runningBackup ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Play className="mr-2 h-4 w-4" />
                                )}
                                Run Backup Now
                            </Button>
                        </div>

                    </CardContent>
                    <CardFooter className="gap-4">
                        <SubmitButton>Save</SubmitButton>
                        <p className="text-red-500">{state?.message}</p>
                    </CardFooter>
                </form>
            </Form >
        </Card >

        <Dialog open={showBackupsDialog} onOpenChange={setShowBackupsDialog}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>System Backups</DialogTitle>
                    <DialogDescription>
                        All available QuickStack system backups from your configured S3 storage
                    </DialogDescription>
                </DialogHeader>

                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        <div className="space-y-2">
                            <p className="font-semibold">Upload and Restore Backup</p>
                            <p className="text-sm">
                                You can upload a system backup file (.tar.gz) to restore your QuickStack instance.
                                The system will automatically extract and replace the database. You will need to restart QuickStack after restoration.
                            </p>
                            <div className="flex items-center gap-2 pt-2">
                                <Input
                                    type="file"
                                    accept=".tar.gz,.tgz"
                                    onChange={handleFileUpload}
                                    disabled={uploadingBackup}
                                    className="max-w-md"
                                />
                                {uploadingBackup && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Restoring backup...
                                    </div>
                                )}
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>

                {loadingBackups ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : backups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No backups found
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Backup Date</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>S3 Key</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {backups.map((backup: any, index: number) => (
                                <TableRow key={index}>
                                    <TableCell>{formatDateTime(backup.date)}</TableCell>
                                    <TableCell>{formatBytes(backup.sizeBytes)}</TableCell>
                                    <TableCell className="font-mono text-xs">{backup.key}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDownloadBackup(backup.key)}
                                            disabled={downloadingBackup === backup.key}
                                        >
                                            {downloadingBackup === backup.key ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Download className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </DialogContent>
        </Dialog>

    </>;
}
