'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { AppBuildMethod, AppSourceInfoInputModel, appSourceInfoInputZodModel } from "@/shared/model/app-source-info.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { saveGeneralAppSourceInfo } from "./actions";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateOrRegenerateGitSshKey } from "./actions";
import { Toast } from "@/frontend/utils/toast.utils";
import { ClipboardCopy, KeyRound, RefreshCw } from "lucide-react";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function GeneralAppSource({ app, readonly, gitSshPublicKey }: {
    app: AppExtendedModel;
    readonly: boolean;
    gitSshPublicKey?: string;
}) {
    const [publicKey, setPublicKey] = useState(gitSshPublicKey);
    const [isPublicKeyDialogOpen, setIsPublicKeyDialogOpen] = useState(false);
    const { openConfirmDialog } = useConfirmDialog();
    const form = useForm<AppSourceInfoInputModel>({
        resolver: zodResolver(appSourceInfoInputZodModel),
        defaultValues: {
            ...app,
            sourceType: app.sourceType as 'GIT' | 'GIT_SSH' | 'CONTAINER',
            buildMethod: (app.buildMethod as AppBuildMethod | undefined) ?? 'RAILPACK',
            dockerfilePath: app.dockerfilePath ?? './Dockerfile',
        },
        disabled: readonly,
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: AppSourceInfoInputModel) => saveGeneralAppSourceInfo(state, payload, app.id), FormUtils.getInitialFormState<typeof appSourceInfoInputZodModel>());
    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Source Info Saved', {
                description: "Click \"deploy\" to apply the changes to your app.",
            });
        }
        FormUtils.mapValidationErrorsToForm<typeof appSourceInfoInputZodModel>(state, form)
    }, [state]);

    const sourceTypeField = form.watch();
    const copyPublicKey = () => {
        if (!publicKey) {
            return;
        }
        navigator.clipboard.writeText(publicKey);
        toast.success('Copied to clipboard.');
    };
    const generateKey = async () => {
        if (publicKey) {
            const confirmed = await openConfirmDialog({
                title: "Regenerate SSH Key",
                description: "This replaces the current app SSH key. Update the deploy key in your git provider before deploying again.",
                okButton: "Regenerate",
            });
            if (!confirmed) {
                return;
            }
        }
        const result = await Toast.fromAction(() => generateOrRegenerateGitSshKey(app.id));
        if (result.status === 'success' && result.data) {
            setPublicKey(result.data);
        }
    };

    return <>
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
                            form.setValue('sourceType', val as 'GIT' | 'GIT_SSH' | 'CONTAINER');
                        }} className="mt-2">
                            <TabsList>
                                {app.appType === 'APP' && <TabsTrigger value="GIT">Git HTTPS</TabsTrigger>}
                                {app.appType === 'APP' && <TabsTrigger value="GIT_SSH">Git SSH</TabsTrigger>}
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

                                    <FormField
                                        control={form.control}
                                        name="gitToken"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Git Token (optional)</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} value={field.value as string | number | readonly string[] | undefined} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

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
                                        name="buildMethod"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Build Method</FormLabel>
                                                <Select
                                                    disabled={field.disabled}
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select build method" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="RAILPACK">detect automatically (using railpack)</SelectItem>
                                                        <SelectItem value="DOCKERFILE">Dockerfile</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {sourceTypeField.buildMethod === 'DOCKERFILE' && (<>
                                        <div></div>
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
                                    </>)}
                                </div>

                            </TabsContent>
                            <TabsContent value="GIT_SSH" className="space-y-4 mt-4">
                                <FormField
                                    control={form.control}
                                    name="gitUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Git SSH Repo URL</FormLabel>
                                            <FormControl>
                                                <Input placeholder="git@github.com:user/repo.git" {...field} value={field.value as string | number | readonly string[] | undefined} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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

                                    {!readonly && <div className="space-y-2">
                                        <Label>SSH Key Authentication (optional)</Label>
                                        <div className="flex items-center gap-2">
                                            {publicKey && <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setIsPublicKeyDialogOpen(true)}
                                                disabled={!publicKey}
                                            >
                                                <KeyRound />
                                                Show Public SSH Key
                                            </Button>}
                                            <Button type="button" variant="secondary" onClick={generateKey}>
                                                {publicKey ? <RefreshCw /> : <KeyRound />}
                                                {publicKey ? 'Regenerate' : 'Generate SSH Keys'}
                                            </Button>
                                        </div>
                                         {publicKey &&<FormDescription>Add this public key as deploy key in your git provider.</FormDescription>}
                                    </div>}

                                    <FormField
                                        control={form.control}
                                        name="buildMethod"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Build Method</FormLabel>
                                                <Select
                                                    disabled={field.disabled}
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select build method" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="RAILPACK">detect automatically (using railpack)</SelectItem>
                                                        <SelectItem value="DOCKERFILE">Dockerfile</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {sourceTypeField.buildMethod === 'DOCKERFILE' && (<>
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
                                    </>)}
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
            </Form >
        </Card >
        <Dialog open={isPublicKeyDialogOpen} onOpenChange={setIsPublicKeyDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Public SSH Key</DialogTitle>
                    <DialogDescription>Add this public key as deploy key in your git provider.</DialogDescription>
                </DialogHeader>
                <Textarea
                    readOnly
                    value={publicKey ?? ''}
                    className="min-h-32 font-mono"
                />
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={copyPublicKey} disabled={!publicKey}>
                        <ClipboardCopy />
                        Copy
                    </Button>
                    <Button type="button" onClick={() => setIsPublicKeyDialogOpen(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

    </>;
}
