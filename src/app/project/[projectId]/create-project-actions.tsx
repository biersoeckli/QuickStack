'use client'

import { Button } from "@/components/ui/button";

import { EditAppDialog } from "./edit-app-dialog";
import { Blocks, Database, File, LayoutGrid, Plus } from "lucide-react";
import ChooseTemplateDialog from "./choose-template-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react";


export default function CreateProjectActions({
    projectId,
}: {
    projectId: string;
}) {

    const [templateType, setTemplateType] = useState<"database" | "template" | undefined>(undefined);

    return (
        <>
            <ChooseTemplateDialog projectId={projectId} templateType={templateType} onClose={() => setTemplateType(undefined)} />
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button><Plus /> Create App</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                    <EditAppDialog projectId={projectId}>
                        <DropdownMenuItem><File /> Empty App</DropdownMenuItem>
                    </EditAppDialog>
                    <DropdownMenuItem onClick={() => setTemplateType('database')}><Database /> Database</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTemplateType('template')}><Blocks /> Template</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}
