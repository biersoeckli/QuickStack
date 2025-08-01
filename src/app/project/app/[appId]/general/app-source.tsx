'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { AppSourceInfoInputModel, appSourceInfoInputZodModel } from "@/shared/model/app-source-info.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { saveGeneralAppSourceInfo, regenerateSshKey } from "./actions";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useEffect, useState, useTransition } from "react";
import { App } from "@prisma/client";
import { toast } from "sonner";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Key } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function GeneralAppSource({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {
    const form = useForm<AppSourceInfoInputModel>({
        resolver: zodResolver(appSourceInfoInputZodModel),
        defaultValues: {
            ...app,
            sourceType: app.sourceType as 'GIT' | 'CONTAINER',
            gitAuthType: app.gitAuthType as 'TOKEN' | 'SSH' | null | undefined
        },
        disabled: readonly,
    });

    const [sshPublicKey, setSshPublicKey] = useState(app.gitSshPublicKey || '');
    const [isPending, startTransition] = useTransition();

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: AppSourceInfoInputModel) => saveGeneralAppSourceInfo(state, payload, app.id), FormUtils.getInitialFormState<typeof appSourceInfoInputZodModel>());
    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Source Info Saved', {
                description: "Click \"deploy\" to apply the changes to your app.",
            });
        }
        FormUtils.mapValidationErrorsToForm<typeof appSourceInfoInputZodModel>(state, form)
    }, [state]);

    const handleRegenerateSshKey = () => {
        startTransition(async () => {
            try {
                const result = await regenerateSshKey(app.id);
                if (result.status === 'success') {
                    setSshPublicKey(result.data);
                    toast.success('SSH Key Regenerated', {
                        description: "Your new SSH public key is ready to be added to your Git repository.",
                    });
                } else {
                    toast.error('Failed to regenerate SSH key', {
                        description: result.message,
                    });
                }
            } catch (error) {
                toast.error('Failed to regenerate SSH key');
            }
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    const sourceTypeField = form.watch();
    const gitAuthType = form.watch('gitAuthType');
    return (
        <Card>
            <CardHeader>
                <CardTitle>Source</CardTitle>
                <CardDescription>Provide Information about the Source of your Application.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-4">
                        <div className="hidden">
                            <FormField
                                control={form.control}
                                name="sourceType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Source Type</FormLabel>
                                        <FormControl>
                                            <Input {...field} value={field.value as string | number | readonly string[] | undefined} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <Label>Source Type</Label>
                        <Tabs defaultValue="GIT" value={sourceTypeField.sourceType} onValueChange={(val) => {
                            form.setValue('sourceType', val as 'GIT' | 'CONTAINER');
                        }} className="mt-2">
                            <TabsList>
                                {app.appType === 'APP' && <TabsTrigger value="GIT">Git</TabsTrigger>}
                                <TabsTrigger value="CONTAINER">Docker Container</TabsTrigger>
                            </TabsList>
                            <TabsContent value="GIT" className="space-y-4 mt-4">
                                <FormField
                                    control={form.control}
                                    name="gitUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Git Repo URL</FormLabel>
                                            <FormControl>
                                                <Input  {...field} value={field.value as string | number | readonly string[] | undefined} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">

                                    <FormField
                                        control={form.control}
                                        name="gitUsername"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Git Username (optional)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value as string | number | readonly string[] | undefined} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="space-y-2">
                                        <FormLabel>Git Authentication</FormLabel>
                                        <div className="space-y-2">
                                            <FormField
                                                control={form.control}
                                                name="gitAuthType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Select value={field.value || 'TOKEN'} onValueChange={field.onChange}>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectGroup>
                                                                        <SelectItem value="TOKEN">Token</SelectItem>
                                                                        <SelectItem value="SSH">SSH Key</SelectItem>
                                                                    </SelectGroup>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            {gitAuthType === 'TOKEN' && (
                                                <FormField
                                                    control={form.control}
                                                    name="gitToken"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <Input type="password" placeholder="Access token" {...field} value={field.value as string | number | readonly string[] | undefined} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                            {gitAuthType === 'SSH' && (
                                                <div className="space-y-2">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-full"
                                                            >
                                                                <Key className="h-4 w-4 mr-2" />
                                                                {sshPublicKey ? 'View SSH Key' : 'SSH Key will be generated'}
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle>SSH Public Key</DialogTitle>
                                                                <DialogDescription>
                                                                    Add this public key as a deploy key to your Git repository to enable SSH authentication.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-4">
                                                                <Textarea
                                                                    readOnly
                                                                    value={sshPublicKey}
                                                                    placeholder="SSH public key will be generated when you save with SSH authentication"
                                                                    className="min-h-[120px] text-xs font-mono"
                                                                />
                                                                <div className="text-xs text-muted-foreground">
                                                                    <p><strong>How to add this as a deploy key:</strong></p>
                                                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                                                        <li><strong>GitHub:</strong> Go to Repository Settings → Deploy keys → Add deploy key</li>
                                                                        <li><strong>GitLab:</strong> Go to Project Settings → Repository → Deploy Keys → Add key</li>
                                                                        <li><strong>Bitbucket:</strong> Go to Repository settings → SSH keys → Add key</li>
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                            <DialogFooter className="gap-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={() => copyToClipboard(sshPublicKey)}
                                                                    disabled={!sshPublicKey}
                                                                >
                                                                    <Copy className="h-4 w-4 mr-2" />
                                                                    Copy Key
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={handleRegenerateSshKey}
                                                                    disabled={isPending || readonly}
                                                                >
                                                                    <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                                                                    Regenerate Key
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                    <p className="text-xs text-muted-foreground">
                                                        SSH authentication provides secure, password-free Git access using cryptographic keys.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="gitBranch"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Git Branch</FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value as string | number | readonly string[] | undefined} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="dockerfilePath"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Path to Dockerfile</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="./Dockerfile"  {...field} value={field.value as string | number | readonly string[] | undefined} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                            </TabsContent>
                            <TabsContent value="CONTAINER" className="space-y-4 mt-4">
                                <FormField
                                    control={form.control}
                                    name="containerImageSource"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Docker Image Name</FormLabel>
                                            <FormControl>
                                                <Input   {...field} value={field.value as string | number | readonly string[] | undefined} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">

                                    <FormField
                                        control={form.control}
                                        name="containerRegistryUsername"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Registry Username</FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value as string | number | readonly string[] | undefined} />
                                                </FormControl>
                                                <FormDescription>Only required if your image is stored in a private registry.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="containerRegistryPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Registry Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} value={field.value as string | number | readonly string[] | undefined} />
                                                </FormControl>
                                                <FormDescription>Only required if your image is stored in a private registry.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                    {!readonly && <CardFooter className="gap-4">
                        <SubmitButton>Save</SubmitButton>
                        <p className="text-red-500">{state?.message}</p>
                    </CardFooter>}
                </form>
            </Form>
        </Card>
    );
}