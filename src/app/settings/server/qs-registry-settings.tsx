'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { useEffect } from "react";
import { toast } from "sonner";
import { setRegistryStorageLocation } from "./actions";
import { S3Target } from "@prisma/client";
import { RegistryStorageLocationSettingsModel, registryStorageLocationSettingsZodModel } from "@/shared/model/registry-storage-location-settings.model";
import SelectFormField from "@/components/custom/select-form-field";
import { Constants } from "@/shared/utils/constants";
import Link from "next/link";

export default function QuickStackRegistrySettings({
    registryStorageLocation,
    s3Targets
}: {
    registryStorageLocation: string;
    s3Targets: S3Target[];
}) {
    const form = useForm<RegistryStorageLocationSettingsModel>({
        resolver: zodResolver(registryStorageLocationSettingsZodModel),
        defaultValues: {
            registryStorageLocation: registryStorageLocation || Constants.INTERNAL_REGISTRY_LOCATION,
        }
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>,
        payload: RegistryStorageLocationSettingsModel) =>
        setRegistryStorageLocation(state, payload),
        FormUtils.getInitialFormState<typeof registryStorageLocationSettingsZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Registry settings updated successfully. It may take a few seconds for the changes to take effect.');
        }
        FormUtils.mapValidationErrorsToForm<typeof registryStorageLocationSettingsZodModel>(state, form)
    }, [state]);

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Registry Storage Location</CardTitle>
                <CardDescription>
                    After a build the Docker Image is stored on the server by default. This can take up a lot of disk space.
                    If your want to store all Docker Images from the registry in a external S3 Storage you can configure it here.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-4">

                        <SelectFormField
                            form={form}
                            name="registryStorageLocation"
                            label="Registry Storage Location"
                            formDescription={<>
                                S3 Storage Locations can be configured <span className="underline"><Link href="/settings/s3-targets">here</Link></span>.
                            </>}
                            values={[
                                [Constants.INTERNAL_REGISTRY_LOCATION, 'Use internal Cluster Storage'],
                                ...s3Targets.map((target) =>
                                    [target.id, `S3: ${target.name}`])
                            ] as [string, string][]}
                        />

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