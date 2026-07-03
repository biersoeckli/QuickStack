'use client'

import { useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { LlmGatewayEditModel, llmGatewayEditZodModel } from "@/shared/model/llm-gateway-edit.model";
import { LlmGatewayModel } from "@/shared/model/llm-gateway.model";
import { deployLiteLlmGatewayInstance, saveLlmGateway, testLlmGatewayConnection } from "./actions";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/custom/submit-button";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CloudUpload, FilePenLine } from "lucide-react";
import { ProjectExtendedModel } from "@/shared/model/project-extended.model";
import { deploy } from "@/app/project/app/[appId]/actions";

function LlmGatewayForm({ gateway }: { gateway?: LlmGatewayModel }) {
    const { closeDialog } = useDialogContext();

    const form = useForm<LlmGatewayEditModel>({
        resolver: zodResolver(llmGatewayEditZodModel),
        defaultValues: {
            id: gateway?.id,
            name: gateway?.name ?? '',
            baseUrl: gateway?.baseUrl ?? '',
            adminKey: '',
        },
    });

    const [state, formAction] = useActionState((actionState: ServerActionResult<any, any>, payload: LlmGatewayEditModel) =>
        saveLlmGateway(actionState, {
            ...payload,
            id: gateway?.id,
        }), FormUtils.getInitialFormState<typeof llmGatewayEditZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            form.reset({
                id: gateway?.id,
                name: '',
                baseUrl: '',
                adminKey: '',
            });
            toast.success(state.message ?? 'LLM Gateway saved successfully.');
            closeDialog();
        }
        FormUtils.mapValidationErrorsToForm<typeof llmGatewayEditZodModel>(state, form);
    }, [closeDialog, form, gateway?.id, state]);

    const runConnectionTest = async () => {
        const values = form.getValues();
        const valid = await form.trigger();
        if (!valid) {
            toast.error('Please fill out all fields before testing the connection.');
            return;
        }

        await Toast.fromAction(
            () => testLlmGatewayConnection({
                ...values,
                id: gateway?.id,
            }),
            'Connection successful.',
            'Testing connection...',
        );
    };

    return (
        <Form {...form}>
            <form
                className="flex max-h-[80vh] flex-col overflow-hidden"
                action={() => form.handleSubmit((data) => formAction(data))()}
            >
                <DialogHeader>
                    <DialogTitle>{gateway ? 'Edit LLM Gateway' : 'Add LLM Gateway'}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="mt-4 flex-1 min-h-0">
                    <div className="space-y-4 px-2">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="baseUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>LiteLLM Base URL</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://litellm.example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="adminKey"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>LiteLLM Admin Key</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder={gateway?.hasAdminKey ? 'Leave blank to keep existing key' : ''}
                                            {...field}
                                            value={field.value ?? ''}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {gateway?.hasAdminKey ? (
                            <p className="text-sm text-muted-foreground">
                                Stored admin key stays hidden. Enter new value only to rotate it.
                            </p>
                        ) : null}

                        <p className="text-red-500">{state.message}</p>
                    </div>
                </ScrollArea>
                <DialogFooter className="mt-4">
                    <SubmitButton>Save</SubmitButton>
                    <Button type="button" variant="outline" onClick={runConnectionTest}>
                        Test Connection
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

function LiteLlmInstanceDeployForm({ projects }: { projects: ProjectExtendedModel[] }) {
    const { closeDialog } = useDialogContext();
    const [targetMode, setTargetMode] = useState<'existing' | 'new'>(projects.length ? 'existing' : 'new');
    const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
    const [newProjectName, setNewProjectName] = useState('LiteLLM');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submit = async () => {
        if (targetMode === 'existing' && !projectId) {
            toast.error('Please select a Project.');
            return;
        }
        if (targetMode === 'new' && !newProjectName.trim()) {
            toast.error('Please enter a Project name.');
            return;
        }

        setIsSubmitting(true);
        try {
            const retVal = await Toast.fromAction(
                () => deployLiteLlmGatewayInstance({
                    projectId: targetMode === 'existing' ? projectId : undefined,
                    newProjectName: targetMode === 'new' ? newProjectName : undefined,
                }),
                'LiteLLM instance deployed.',
                'Deploying LiteLLM instance...',
            );

            const createdAppids = retVal!.data!;
            closeDialog(createdAppids);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <DialogHeader>
                <DialogTitle>Deploy new LiteLLM instance</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label>Project</Label>
                    <Select
                        value={targetMode}
                        onValueChange={(value) => setTargetMode(value as 'existing' | 'new')}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.length ? <SelectItem value="existing">Existing Project</SelectItem> : null}
                            <SelectItem value="new">New Project</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {targetMode === 'existing' ? (
                    <div className="grid gap-2">
                        <Label>Existing Project</Label>
                        <Select value={projectId} onValueChange={setProjectId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Project" />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map((project) => (
                                    <SelectItem key={project.id} value={project.id}>
                                        {project.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div className="grid gap-2">
                        <Label htmlFor="litellm-project-name">New Project Name</Label>
                        <Input
                            id="litellm-project-name"
                            value={newProjectName}
                            onChange={(event) => setNewProjectName(event.target.value)}
                        />
                    </div>
                )}
            </div>

            <DialogFooter>
                <Button onClick={submit} disabled={isSubmitting}>
                    Deploy
                </Button>
                <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                </Button>
            </DialogFooter>
        </div>
    );
}

export default function LlmGatewayEditOverlay({
    children,
    gateway,
    projects = [],
}: {
    children: React.ReactNode;
    gateway?: LlmGatewayModel;
    projects?: ProjectExtendedModel[];
}) {
    const { openDialog } = useDialog();
    const { openConfirmDialog } = useConfirmDialog();

    const handleOpen = () => {
        openDialog(<LlmGatewayForm gateway={gateway} />, { maxWidth: '520px' });
    };

    const handleDeployOpen = async () => {
        const createdApps = await openDialog(<LiteLlmInstanceDeployForm projects={projects} />, { maxWidth: '520px' }) as string[] | undefined;
        if (createdApps?.length) {
            if (await openConfirmDialog({
                title: 'Deploy created apps?',
                description: `The ressources for the LiteLLM instance have been created. Do you want to deploy the created apps now?`,
                okButton: 'Deploy',
                cancelButton: 'Later',
            })) {
                for (const appId of createdApps) {
                    await Toast.fromAction(() => deploy(appId));
                }
                toast.success(`Started LiteLLM instance deployment.`);
            }
        }
    };

    if (!gateway) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    {children}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleOpen}>
                        <FilePenLine />
                        Enter configuration manually
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDeployOpen}>
                        <CloudUpload />
                        Deploy new LiteLLM instance
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <div onClick={handleOpen}>
            {children}
        </div>
    );
}
