'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useState } from "react";
import { AppTemplateModel } from "@/shared/model/app-template.model"
import { allTemplates, appTemplates, databaseTemplates } from "@/shared/templates/all.templates"
import CreateTemplateAppSetupDialog from "./create-template-app-setup-dialog"
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";



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
    const [searchQuery, setSearchQuery] = useState<string>("");

    useEffect(() => {
        if (templateType) {
            setIsOpen(true);
            setSearchQuery("");
        }
        if (templateType === 'database') {
            setDisplayedTemplates(databaseTemplates.sort((a, b) => a.name.localeCompare(b.name)));
        }
        if (templateType === 'template') {
            setDisplayedTemplates(appTemplates.sort((a, b) => a.name.localeCompare(b.name)));
        }
    }, [templateType]);

    const filteredTemplates = displayedTemplates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <ScrollArea className="max-h-[60vh]">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-1">
                            {filteredTemplates.map((template) => {
                                const isUrl = template.iconName?.startsWith('http://') || template.iconName?.startsWith('https://');
                                const iconSrc = template.iconName ? (isUrl ? template.iconName : `/template-icons/${template.iconName}`) : undefined;
                                
                                return (
                                    <div key={template.name}
                                        className="h-42 grid grid-cols-1 gap-4 items-center bg-white rounded-md p-4 border border-gray-200 text-center hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer"
                                        onClick={() => {
                                            setIsOpen(false);
                                            setChosenAppTemplate(template);
                                        }} >
                                        {iconSrc && <img src={iconSrc} className="h-10 mx-auto" />}
                                        <h3 className="text-lg font-semibold">{template.name}</h3>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    )



}