'use client';

import { Button } from "@/components/ui/button";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { TrashIcon, EditIcon } from "lucide-react";
import { LlmGatewayModel } from "@/shared/model/llm-gateway.model";
import LlmGatewayEditOverlay from "./llm-gateway-edit-overlay";
import { deleteLlmGateway } from "./actions";

export default function LlmGatewaysTable({ gateways }: {
    gateways: LlmGatewayModel[]
}) {
    const { openConfirmDialog } = useConfirmDialog();

    const onDelete = async (id: string) => {
        const confirmed = await openConfirmDialog({
            title: "Delete LLM Gateway",
            description: "Do you really want to delete this LLM Gateway?",
            okButton: "Delete LLM Gateway",
        });

        if (confirmed) {
            await Toast.fromAction(() => deleteLlmGateway(id));
        }
    };

    return (
        <SimpleDataTable
            columns={[
                ['id', 'ID', false],
                ['name', 'Name', true],
                ['baseUrl', 'Base URL', true],
                ['createdAt', 'Created At', true, (item) => formatDateTime(item.createdAt)],
                ['updatedAt', 'Updated At', false, (item) => formatDateTime(item.updatedAt)],
            ]}
            data={gateways}
            actionCol={(item) => (
                <div className="flex">
                    <div className="flex-1" />
                    <LlmGatewayEditOverlay gateway={item}>
                        <Button variant="ghost"><EditIcon /></Button>
                    </LlmGatewayEditOverlay>
                    <Button variant="ghost" onClick={() => onDelete(item.id)}>
                        <TrashIcon />
                    </Button>
                </div>
            )}
        />
    );
}
