'use client'

import { Button } from "@/components/ui/button";

import { EditAppDialog } from "./app-components/edit-app-dialog";
import { Blocks, Bot, Database, File, Plus } from "lucide-react";
import ChooseTemplateDialog from "./choose-template-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
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
                    <DropdownMenuLabel>Apps</DropdownMenuLabel>
                    <EditAppDialog openAppAfterCreate={currentlyOpenedTab === 'table'} projectId={projectId}>
                        <DropdownMenuItem><File /> Empty App</DropdownMenuItem>
                    </EditAppDialog>
                    <DropdownMenuItem onClick={() => openTemplateDialog('database')}><Database /> Database</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openTemplateDialog('template')}><Blocks /> App Template</DropdownMenuItem>
                    {agentsAvailable && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Agents</DropdownMenuLabel>
                            <CreateAgentDialog projectId={projectId}>
                                <DropdownMenuItem><Bot /> Empty Agent</DropdownMenuItem>
                            </CreateAgentDialog>
                            <DropdownMenuItem onClick={() => openTemplateDialog('agent-template')}><Blocks /> Agent Template</DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}
