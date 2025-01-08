'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useState } from "react";
import { AppTemplateModel } from "@/shared/model/app-template.model"
import { allTemplates, appTemplates, databaseTemplates } from "@/shared/templates/all.templates"
import CreateTemplateAppSetupDialog from "./create-template-app-setup-dialog"
import { ScrollArea } from "@/components/ui/scroll-area";



export default function ChooseTemplateDialog({
    projectId,
    templateType,
    onClose
}: {
    projectId: string;
    templateType: 'database' | 'template' | undefined;
    onClose: () => void;
}) {

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [chosenAppTemplate, setChosenAppTemplate] = useState<AppTemplateModel | undefined>(undefined);
    const [displayedTemplates, setDisplayedTemplates] = useState<AppTemplateModel[]>([]);

    useEffect(() => {
        if (templateType) {
            setIsOpen(true);
        }
        if (templateType === 'database') {
            setDisplayedTemplates(databaseTemplates);
        }
        if (templateType === 'template') {
            setDisplayedTemplates(appTemplates);
        }
    }, [templateType]);

    return (
        <>
            <CreateTemplateAppSetupDialog appTemplate={chosenAppTemplate} projectId={projectId}
                dialogClosed={() => {
                    setChosenAppTemplate(undefined);
                    onClose();
                }} />
            <Dialog open={!!isOpen} onOpenChange={(isOpened) => {
                setIsOpen(isOpened);
                if (!isOpened) {
                    onClose();
                }
            }}>
                <DialogContent className="sm:max-w-[1000px]">
                    <DialogHeader>
                        <DialogTitle>Create {templateType === 'database' ? 'Database' : 'App'} from Template</DialogTitle>
                        <DialogDescription>
                            Choose a Template you want to deploy.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh]">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-1">
                            {displayedTemplates.map((template) => (
                                <div key={template.name}
                                    className="h-42 grid grid-cols-1 gap-4 items-center bg-white rounded-md p-4 border border-gray-200 text-center hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer"
                                    onClick={() => {
                                        setIsOpen(false);
                                        setChosenAppTemplate(template);
                                    }} >
                                    {template.iconName && <img src={`/template-icons/${template.iconName}`} className="h-10 mx-auto" />}
                                    <h3 className="text-lg font-semibold">{template.name}</h3>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    )



}