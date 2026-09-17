'use client'

import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useState } from "react";
import { AppTemplateModel } from "@/shared/model/app-template.model"
import { appTemplates, databaseTemplates } from "@/shared/templates/all.templates"
import CreateTemplateAppSetupDialog from "./app-components/create-template-app-setup-dialog"
import CreateTemplateAgentSetupDialog from "./agent-components/create-template-agent-setup-dialog"
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, Blocks, Bot, Database, Search } from "lucide-react";
import { AgentTemplateModel } from "@/shared/model/agent-template.model";
import { agentTemplates } from "@/shared/templates/all-agent.templates";
import Image from "next/image";
import { useDialog } from "@/frontend/states/zustand.states";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";



export default function ChooseTemplateDialog({
    projectId,
    templateType
}: {
    projectId: string;
    templateType: 'database' | 'template' | 'agent-template';
}) {
    const { closeDialog } = useDialogContext();
    const { openDialog } = useDialog();
    const [displayedTemplates, setDisplayedTemplates] = useState<(AppTemplateModel | AgentTemplateModel)[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const templateLabel = templateType === 'database' ? 'Database' : templateType === 'agent-template' ? 'Agent' : 'App';
    const TemplateIcon = templateType === 'database' ? Database : templateType === 'agent-template' ? Bot : Blocks;

    useEffect(() => {
        setSearchQuery("");
        if (templateType === 'database') {
            setDisplayedTemplates([...databaseTemplates].sort((a, b) => a.name.localeCompare(b.name)));
        }
        if (templateType === 'template') {
            setDisplayedTemplates([...appTemplates].sort((a, b) => a.name.localeCompare(b.name)));
        }
        if (templateType === 'agent-template') {
            setDisplayedTemplates([...agentTemplates].sort((a, b) => a.name.localeCompare(b.name)));
        }
    }, [templateType]);

    const filteredTemplates = displayedTemplates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openTemplateSetup = (template: AppTemplateModel | AgentTemplateModel) => {
        closeDialog();

        if (templateType === 'agent-template') {
            openDialog(
                <CreateTemplateAgentSetupDialog agentTemplate={template as AgentTemplateModel} projectId={projectId} />,
                { maxWidth: '900px' }
            );
            return;
        }

        openDialog(
            <CreateTemplateAppSetupDialog appTemplate={template as AppTemplateModel} projectId={projectId} />,
            { maxWidth: '900px' }
        );
    };

    return (
        <>
            <DialogHeader>
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border bg-muted/50 text-muted-foreground">
                        <TemplateIcon className="size-5" />
                    </div>
                    <div className="space-y-1">
                        <DialogTitle>Create {templateLabel} from Template</DialogTitle>
                        <DialogDescription>
                            Choose a template to deploy. {displayedTemplates.length} available.
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    type="text"
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>
            <ScrollArea className="max-h-[60vh] pr-3">
                <div className="grid grid-cols-1 gap-3 px-1 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredTemplates.map((template) => {
                        const isUrl = template.iconName?.startsWith('http://') || template.iconName?.startsWith('https://');
                        const iconSrc = template.iconName ? (isUrl ? template.iconName : `/template-icons/${template.iconName}`) : undefined;

                        return (
                            <Button
                                key={template.name}
                                variant="outline"
                                className="h-full min-h-42 w-full cursor-pointer rounded-2xl p-0 text-left shadow-none hover:border-primary/40 hover:bg-transparent hover:shadow-md"
                                onClick={() => openTemplateSetup(template)}
                            >
                                <Card className="h-full w-full gap-0 rounded-[inherit] py-0 shadow-none ring-0">
                                    <CardHeader className="grid-cols-[auto_1fr_auto] gap-3 px-5 pt-5">
                                        <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/40 p-2">
                                            {iconSrc && <Image src={iconSrc} alt="" width={40} height={40} className="size-10 object-contain" unoptimized />}
                                        </div>
                                        <CardTitle className="self-center text-base">{template.name}</CardTitle>
                                        <div className="self-center justify-self-end text-muted-foreground">
                                            <ArrowUpRight className="size-4" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex flex-1 px-5 pt-4">
                                        <p className="truncate text-sm  text-muted-foreground">
                                            {template.description ?? `A preconfigured ${templateLabel.toLowerCase()} ready to deploy.`}
                                        </p>
                                    </CardContent>
                                    <CardFooter className="px-5 pb-5">
                                        <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                            {templateLabel}
                                        </span>
                                    </CardFooter>
                                </Card>
                            </Button>
                        );
                    })}
                    {filteredTemplates.length === 0 && (
                        <Empty className="col-span-full min-h-60">
                            <EmptyHeader>
                                <EmptyMedia variant="icon"><Search /></EmptyMedia>
                                <EmptyTitle>No templates found</EmptyTitle>
                                <EmptyDescription>
                                    No {templateLabel.toLowerCase()} template matches “{searchQuery}”.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </div>
            </ScrollArea>
        </>
    )



}
