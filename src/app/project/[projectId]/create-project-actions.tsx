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
import { CreateAgentDialog } from "./create-agent-dialog";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import { useDialog } from "@/frontend/states/zustand.states";


export default function CreateProjectActions({
    projectId,
    projectType = 'app',
}: {
    projectId: string;
    projectType?: WorkloadType;
}) {

    const { openDialog } = useDialog();
    const isAgentProject = projectType.toLocaleLowerCase() === 'agent';
    const openTemplateDialog = (templateType: "database" | "template" | "agent-template") => {
        openDialog(
            <ChooseTemplateDialog projectId={projectId} templateType={templateType} />,
            { maxWidth: '1000px' }
        );
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button><Plus /> Create {isAgentProject ? 'Agent' : 'App'}</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                    {isAgentProject ? (
                        <>
                            <CreateAgentDialog projectId={projectId}>
                                <DropdownMenuItem><Bot /> Empty Agent</DropdownMenuItem>
                            </CreateAgentDialog>
                            <DropdownMenuItem onClick={() => openTemplateDialog('agent-template')}><Blocks /> Template</DropdownMenuItem>
                        </>
                    ) : (
                        <>
                            <EditAppDialog projectId={projectId}>
                                <DropdownMenuItem><File /> Empty App</DropdownMenuItem>
                            </EditAppDialog>
                            <DropdownMenuItem onClick={() => openTemplateDialog('database')}><Database /> Database</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openTemplateDialog('template')}><Blocks /> Template</DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}
