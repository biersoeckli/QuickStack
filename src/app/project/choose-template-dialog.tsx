'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useState } from "react";
import { AppTemplateModel } from "@/shared/model/app-template.model"
import { allTemplates } from "@/shared/templates/all.templates"
import CreateTemplateAppSetupDialog from "./create-template-app-setup-dialog"



export default function ChooseTemplateDialog({
    projectId,
    children
}: {
    projectId: string;
    children: React.ReactNode;
}) {

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [chosenAppTemplate, setChosenAppTemplate] = useState<AppTemplateModel | undefined>(undefined);

    return (
        <>
            <CreateTemplateAppSetupDialog appTemplate={chosenAppTemplate} projectId={projectId}
                dialogClosed={() => setChosenAppTemplate(undefined)} />

            <div onClick={() => setIsOpen(true)}>{children}</div>
            <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(false)}>
                <DialogContent className="sm:max-w-[1000px]">
                    <DialogHeader>
                        <DialogTitle>Create App from Template</DialogTitle>
                        <DialogDescription>
                            Choose a Template you want to deploy.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {allTemplates.map((template) => (
                            <div key={template.name}
                                className="bg-white rounded-md p-4 border border-gray-200 text-center hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer"
                                onClick={() => {
                                    setIsOpen(false);
                                    setChosenAppTemplate(template);
                                }} >
                                <h3 className="text-lg font-semibold py-5">{template.name}</h3>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )



}