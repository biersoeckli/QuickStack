'use client'

import { Button } from "@/components/ui/button";

import { EditAppDialog } from "./edit-app-dialog";
import { Blocks, Bot, Database, File, Plus } from "lucide-react";
import ChooseTemplateDialog from "./choose-template-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react";
import { CreateAgentDialog } from "./create-agent-dialog";
import { WorkloadType } from "@/shared/model/runtime-type.model";


export default function CreateProjectActions({
    projectId,
    projectType = 'app',
}: {
    projectId: string;
    projectType?: WorkloadType;
}) {

    const [templateType, setTemplateType] = useState<"database" | "template" | "agent-template" | undefined>(undefined);
    const isAgentProject = projectType.toLocaleLowerCase() === 'agent';

    return (
        <>
            <ChooseTemplateDialog projectId={projectId} templateType={templateType} onClose={() => setTemplateType(undefined)} />
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button><Plus /> Create {isAgentProject ? 'Agent' : 'App'}</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                    {isAgentProject ? (
                        <>
                            <CreateAgentDialog projectId={projectId}>
                                <DropdownMenuItem><Bot /> Empty Agent</DropdownMenuItem>
                            </CreateAgentDialog>
                            <DropdownMenuItem onClick={() => setTemplateType('agent-template')}><Blocks /> Template</DropdownMenuItem>
                        </>
                    ) : (
                        <>
                            <EditAppDialog projectId={projectId}>
                                <DropdownMenuItem><File /> Empty App</DropdownMenuItem>
                            </EditAppDialog>
                            <DropdownMenuItem onClick={() => setTemplateType('database')}><Database /> Database</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTemplateType('template')}><Blocks /> Template</DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}
