'use client'

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Toast } from '@/frontend/utils/toast.utils';
import { ProjectType } from '@/shared/model/project-type.model';
import { Project } from '@prisma/client';
import { useState } from 'react';
import { createProject } from './actions';

export function EditProjectDialog({ children, existingItem }: {
    children?: React.ReactNode;
    existingItem?: Project;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(existingItem?.name ?? '');
    const [projectType, setProjectType] = useState<ProjectType | undefined>(
        existingItem?.projectType as ProjectType | undefined,
    );

    const openDialog = () => {
        setName(existingItem?.name ?? '');
        setProjectType(existingItem?.projectType as ProjectType | undefined);
        setOpen(true);
    };

    const submit = async () => {
        if (!name.trim() || !projectType) return;
        await Toast.fromAction(() => createProject(name.trim(), projectType, existingItem?.id));
        setOpen(false);
    };

    return <>
        <div onClick={openDialog}>{children}</div>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{existingItem ? 'Edit Project' : 'Create Project'}</DialogTitle>
                    <DialogDescription>
                        {existingItem
                            ? 'Rename this Project. Project Type cannot be changed.'
                            : 'Choose the workload type this Project will contain.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="project-name">Name</Label>
                        <Input
                            id="project-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Project Type</Label>
                        <Select
                            disabled={!!existingItem}
                            value={projectType}
                            onValueChange={(value) => setProjectType(value as ProjectType)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Project Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="APP">App</SelectItem>
                                <SelectItem value="AGENT">Agent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button disabled={!name.trim() || !projectType} onClick={submit}>
                        {existingItem ? 'Save Project' : 'Create Project'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>;
}
