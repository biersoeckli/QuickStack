'use client';

import { Button } from "@/components/ui/button";
import { EditIcon, TrashIcon } from "lucide-react";
import DialogEditDialog from "./s3-target-edit-overlay";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { S3Target } from "@prisma/client";
import React from "react";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { deleteS3Target } from "./actions";

export default function S3TargetsTable({ targets }: {
    targets: S3Target[]
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteTarget = async (id: string) => {
        const confirm = await openDialog({
            title: "Delete S3 Target",
            description: "Do you really want to delete this S3 Target?",
            okButton: "Delete S3 Target"
        });
        if (confirm) {
            await Toast.fromAction(() => deleteS3Target(id));
        }
    };

    return <>
        <SimpleDataTable columns={[
            ['id', 'ID', false],
            ['name', 'Name', true],
            ["createdAt", "Created At", true, (item) => formatDateTime(item.createdAt)],
            ["updatedAt", "Updated At", false, (item) => formatDateTime(item.updatedAt)],
        ]}
            data={targets}
            actionCol={(item) =>
                <>
                    <div className="flex">
                        <div className="flex-1"></div>
                        <DialogEditDialog target={item}>
                            <Button variant="ghost"><EditIcon /></Button>
                        </DialogEditDialog>
                        <Button variant="ghost" onClick={() => asyncDeleteTarget(item.id)}>
                            <TrashIcon />
                        </Button>
                    </div>
                </>}
        />
    </>;
}