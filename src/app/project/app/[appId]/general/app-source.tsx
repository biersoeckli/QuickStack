'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { AppSourceInfoInputModel, appSourceInfoInputZodModel } from "@/shared/model/app-source-info.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { saveGeneralAppSourceInfo } from "./actions";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useEffect } from "react";
import { App } from "@prisma/client";
import { toast } from "sonner";
import { AppExtendedModel } from "@/shared/model/app-extended.model";

export default function GeneralAppSource({ app }: {
    app: AppExtendedModel
}) {
    const form = useForm<AppSourceInfoInputModel>({
        resolver: zodResolver(appSourceInfoInputZodModel),
        defaultValues: {
            ...app,
            sourceType: app.sourceType as 'GIT' | 'CONTAINER'
        }
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
                    <CardFooter className="gap-4">
                        <SubmitButton>Save</SubmitButton>
                        <p className="text-red-500">{state?.message}</p>
                    </CardFooter>
                </form>
            </Form >
        </Card >

    </>;
}