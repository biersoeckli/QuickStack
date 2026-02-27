'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/frontend/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { useEffect } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { AppVolume } from "@prisma/client";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { StorageClassInfoModel } from "@/shared/model/storage-class-info.model";
import { migrateVolumeStorageClass } from "./actions";
import { toast } from "sonner";
import { z } from "zod";
import { MigrationStatusResult } from "@/server/services/pvc-migration.service";
import { NodeInfoModel } from "@/shared/model/node-info.model";

const migrationFormSchema = z.object({
    targetStorageClassName: z.string().min(1, { message: "Please select a target storage class." }),
});
type MigrationFormModel = z.infer<typeof migrationFormSchema>;

export default function StorageMigrationDialog({
    open,
    onOpenChange,
    volume,
    app,
    storageClasses,
    nodesInfo,
    migrationStatus,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    volume: AppVolume;
    app: AppExtendedModel;
    storageClasses: StorageClassInfoModel[];
    nodesInfo: NodeInfoModel[];
    migrationStatus: MigrationStatusResult;
}) {

    const availableTargetClasses = (nodesInfo.length > 1
        ? storageClasses.filter(sc => sc.name !== 'local-path')
        : storageClasses
    ).filter(sc => sc.name !== volume.storageClassName);

    const form = useForm<MigrationFormModel>({
        resolver: zodResolver(migrationFormSchema),
        defaultValues: { targetStorageClassName: availableTargetClasses[0]?.name ?? '' },
    });

    const [state, formAction] = useFormState(
        async (_prev: any, data: MigrationFormModel) => {
            return migrateVolumeStorageClass(volume.id, data.targetStorageClassName);
        },
        FormUtils.getInitialFormState<typeof migrationFormSchema>()
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Storage class migration completed.', {
                description: 'The volume has been migrated. The old data is still available at the "_old" mount path.',
            });
            onOpenChange(false);
        } else if (state.status === 'error') {
            toast.error('Migration failed', { description: state.message });
        }
    }, [state]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Migrate Storage Class</DialogTitle>
                    <DialogDescription>
                        Migrate the data of <b>{volume.containerMountPath}</b> to a different storage class.
                    </DialogDescription>
                </DialogHeader>

                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            Current storage class: <b>{volume.storageClassName}</b>
                        </div>

                        {app.replicas > 0 && (
                            <div className="rounded-md border border-yellow-400 bg-yellow-50 dark:bg-yellow-950 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                                <b>Warning:</b> Your app is currently running and will be <b>stopped</b> during the migration.
                            </div>
                        )}

                        <div className="rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-800 dark:text-blue-200">
                            The app will be stopped, data copied via rsync to the new PVC, then the app will restart.
                            The original PVC is kept with an <b>_old</b> suffix on its mount path.
                            Duration depends on data size and may take several minutes.
                        </div>

                        {availableTargetClasses.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No other storage classes are available to migrate to.</p>
                        ) : (
                            <Form {...form}>
                                <form action={(e) => form.handleSubmit((data) => formAction(data))()}>
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="targetStorageClassName"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Target Storage Class</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                                                >
                                                                    {field.value
                                                                        ? field.value + (availableTargetClasses.find(sc => sc.name === field.value)?.isDefault ? ' (Default)' : '')
                                                                        : "Select target storage class"}
                                                                    <ChevronsUpDown className="opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="max-w-[280px] p-0">
                                                            <Command>
                                                                <CommandList>
                                                                    <CommandGroup>
                                                                        {availableTargetClasses.map((sc) => (
                                                                            <CommandItem
                                                                                value={sc.name}
                                                                                key={sc.name}
                                                                                onSelect={() => form.setValue("targetStorageClassName", sc.name)}
                                                                            >
                                                                                <span>{sc.name}{sc.isDefault ? ' (Default)' : ''}</span>
                                                                                <Check className={cn("ml-auto", sc.name === field.value ? "opacity-100" : "opacity-0")} />
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <p className="text-red-500 text-sm">{state.message}</p>
                                        <SubmitButton>Start Migration</SubmitButton>
                                    </div>
                                </form>
                            </Form>
                        )}
                    </div>
            </DialogContent>
        </Dialog>
    );
}
