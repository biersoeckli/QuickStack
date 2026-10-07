'use client'

import { Button } from "@/components/ui/button";

import { EditAppDialog } from "./app-components/edit-app-dialog";
import { Blocks, Bot, Database, File, Plus } from "lucide-react";
import ChooseTemplateDialog from "./choose-template-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateAgentDialog } from "./agent-components/create-agent-dialog";
import { useDialog } from "@/frontend/states/zustand.states";


export default function CreateProjectActions({
    projectId,
    agentsAvailable = false,
    currentlyOpenedTab = 'table'
}: {
    projectId: string;
    agentsAvailable?: boolean;
    currentlyOpenedTab?: 'table' | 'graph';
}) {

    const { openDialog } = useDialog();
    const openTemplateDialog = (templateType: "database" | "template" | "agent-template") => {
        openDialog(
            <ChooseTemplateDialog projectId={projectId} templateType={templateType} />,
            { maxWidth: '1000px' }
        );
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button><Plus /> Create</Button>} />
                <DropdownMenuContent>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2">
                            <File />
                            Create App
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <EditAppDialog openAppAfterCreate={currentlyOpenedTab === 'table'} projectId={projectId}>
                                <DropdownMenuItem>
                                    <File />
                                    Empty App
                                </DropdownMenuItem>
                            </EditAppDialog>
                            <DropdownMenuItem onClick={() => openTemplateDialog('template')}>
                                <Blocks />
                                App from Template
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={() => openTemplateDialog('database')}>
                        <Database />
                        Create Database
                    </DropdownMenuItem>
                    {agentsAvailable && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="gap-2">
                                <Bot />
                                Create Agent Sandbox
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                            <CreateAgentDialog projectId={projectId}>
                                    <DropdownMenuItem>
                                        <Bot />
                                        Empty Agent Sandbox
                                    </DropdownMenuItem>
                            </CreateAgentDialog>
                                <DropdownMenuItem onClick={() => openTemplateDialog('agent-template')}>
                                    <Blocks />
                                    Agent Sandbox from Template
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}
