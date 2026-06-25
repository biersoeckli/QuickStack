'use client'

import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { useActionState, useEffect } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { AuthFormInputSchema, authFormInputSchemaZod, RegisterFormInputSchema, registgerFormInputSchemaZod } from "@/shared/model/auth-form"
import { registerUser } from "./actions"
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { redirect } from "next/navigation"
import FormLabelWithQuestion from "@/components/custom/form-label-with-question"
import { toast } from "sonner"

export default function UserRegistrationForm() {
    const form = useForm<RegisterFormInputSchema>({
        resolver: zodResolver(registgerFormInputSchemaZod)
    });

    const [state, formAction] = useActionState(registerUser, FormUtils.getInitialFormState<typeof registgerFormInputSchemaZod>());

    useEffect(() => {
        if (state.status === 'success') {
            toast.success(state.message ?? 'Registration successful. You can now login.');
            window.location.reload();
        }
    }, [state]);

    return (
        <Card className="w-[350px] mx-auto">
            <CardHeader>
                <CardTitle>Registration</CardTitle>
                <CardDescription>Enter your credentials to register for QuickStack.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => formAction(data))()}
                    className="space-y-8">
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>E-Mail</FormLabel>
                                    <FormControl>
                                        <Input {...field} value={field.value as string | number | readonly string[] | undefined} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input type="password"  {...field} value={field.value as string | number | readonly string[] | undefined} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="qsHostname"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabelWithQuestion hint="This domain will be used to access your QuickStack instance. Make sure the DNS settings of the domain are correctly configured to point to the server IP address. This can also be configured later in the QuickStack settings.">
                                        QuickStack Domain (optional)
                                    </FormLabelWithQuestion>
                                    <FormControl>
                                        <Input {...field} value={field.value as string | number | readonly string[] | undefined} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <p className="text-red-500">{state?.message}</p>
                    </CardContent>
                    <CardFooter>
                        <SubmitButton className="w-full">Register</SubmitButton>
                    </CardFooter>
                </form>
            </Form>
        </Card >
    )
}
