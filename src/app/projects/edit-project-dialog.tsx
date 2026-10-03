'use client'

import { Button } from '@/components/ui/button';
import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toast } from '@/frontend/utils/toast.utils';
import { useDialogContext } from '@/frontend/states/dialog-context';
import { useDialog } from '@/frontend/states/zustand.states';
import { Project } from '@prisma/client';
import { useState } from 'react';
import { createProject } from './actions';

function EditProjectForm({ existingItem }: {
    existingItem?: Project;
}) {
    const { closeDialog } = useDialogContext();
    const [name, setName] = useState(existingItem?.name ?? '');

    const submit = async () => {
        if (!name.trim()) return;
        await Toast.fromAction(() => createProject(name.trim(), existingItem?.id));
        closeDialog();
    };

    return <>
        <DialogHeader>
            <DialogTitle>{existingItem ? 'Edit Project' : 'Create Project'}</DialogTitle>
            <DialogDescription>
                {existingItem
                    ? 'Rename this Project.'
                    : 'Projects can contain both Apps and Agent Sandboxes.'}
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
        </div>
        <DialogFooter>
            <Button disabled={!name.trim()} onClick={submit}>
                {existingItem ? 'Save Project' : 'Create Project'}
            </Button>
            <Button variant="secondary" onClick={() => closeDialog()}>Cancel</Button>
        </DialogFooter>
    </>;
}

export function EditProjectDialog({ children, existingItem }: {
    children?: React.ReactNode;
    existingItem?: Project;
}) {
    const { openDialog } = useDialog();

    const handleOpen = () => {
        openDialog(<EditProjectForm existingItem={existingItem} />, { maxWidth: '425px' });
    };

    return <div onClick={handleOpen}>{children}</div>;
}
