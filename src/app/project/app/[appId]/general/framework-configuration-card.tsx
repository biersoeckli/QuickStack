'use client';

import { SubmitButton } from '@/components/custom/submit-button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { FormUtils } from '@/frontend/utils/form.utilts';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { AppFrameworkConfigurationModel, appFrameworkConfigurationZodModel } from '@/shared/model/app-source-info.model';
import { ServerActionResult } from '@/shared/model/server-action-error-return.model';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useActionState, useEffect } from 'react';
import { Control, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { saveFrameworkConfiguration } from './actions';
import { JsFramework, jsFrameworkPresets } from '@/shared/model/js-framework.model';

export default function FrameworkConfigurationCard({ app, readonly }: { app: AppExtendedModel; readonly: boolean }) {
    const frameworkPreset = app.framework ? jsFrameworkPresets[app.framework as JsFramework] : undefined;
    const form = useForm<z.input<typeof appFrameworkConfigurationZodModel>, unknown, z.output<typeof appFrameworkConfigurationZodModel>>({
        resolver: zodResolver(appFrameworkConfigurationZodModel),
        defaultValues: {
            installCommand: app.installCommand ?? '',
            buildCommand: app.buildCommand ?? '',
            runCommand: app.runCommand ?? '',
            rootDirectory: app.rootDirectory ?? './',
            outputDirectory: app.outputDirectory ?? '',
            nodeVersion: app.nodeVersion ?? '',
        },
        disabled: readonly,
    });
    const [state, formAction] = useActionState(
        (currentState: ServerActionResult<any, any>, payload: AppFrameworkConfigurationModel) =>
            saveFrameworkConfiguration(currentState, payload, app.id),
        FormUtils.getInitialFormState<typeof appFrameworkConfigurationZodModel>()
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Configuration Saved', {
                description: 'Click "deploy" to apply the changes to your app.',
            });
        }
        FormUtils.mapValidationErrorsToForm<typeof appFrameworkConfigurationZodModel>(state, form);
    }, [form, state]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center gap-3">
                {frameworkPreset && (
                    <Image
                        src={frameworkPreset.logoSrc}
                        alt={`${frameworkPreset.label} logo`}
                        width={40}
                        height={40}
                        unoptimized
                        className="size-10 shrink-0 object-contain"
                    />
                )}
                <div>
                    <CardTitle>{frameworkPreset?.label ?? app.framework ?? 'Build'} Configuration</CardTitle>
                    <CardDescription>Configure the build and runtime commands for this app.</CardDescription>
                </div>
            </CardHeader>
            <Form {...form}>
                <form action={() => form.handleSubmit((data) => formAction(data))()}>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <CommandField control={form.control} name="installCommand" label="Install Command" placeholder="npm install" />
                            <CommandField control={form.control} name="buildCommand" label="Build Command" placeholder="npm run build" />
                            <CommandField control={form.control} name="rootDirectory" label="Root Directory" placeholder="./" />
                            <CommandField control={form.control} name="outputDirectory" label="Output Directory" placeholder="dist" />
                            <CommandField control={form.control} name="runCommand" label="Start Command" placeholder="Leave empty to serve static output" />
                            <CommandField control={form.control} name="nodeVersion" label="Node Version" placeholder="lts" />
                        </div>
                    </CardContent>
                    {!readonly && (
                        <CardFooter className="gap-4">
                            <SubmitButton>Save</SubmitButton>
                            <p className="text-red-500">{state.message}</p>
                        </CardFooter>
                    )}
                </form>
            </Form>
        </Card>
    );
}

function CommandField({ control, name, label, placeholder }: {
    control: Control<z.input<typeof appFrameworkConfigurationZodModel>>;
    name: keyof z.input<typeof appFrameworkConfigurationZodModel>;
    label: string;
    placeholder: string;
}) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input className="font-mono text-sm" placeholder={placeholder} {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
