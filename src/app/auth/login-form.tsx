'use client'

import type { z } from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useState } from "react";
import { AuthFormInputSchema, authFormInputSchemaZod } from "@/shared/model/auth-form"
import { authUser } from "./actions"
import { signIn } from "next-auth/react";
import LoadingSpinner from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import TwoFaAuthForm from "./two-fa-auth"
import { SsoProviderType } from "@/shared/model/sso-provider.model";
import { SsoProviderLogo } from "@/components/custom/sso-provider-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

type SsoLoginProvider = {
    id: string;
    name: string;
    type: SsoProviderType;
};

export default function UserLoginForm({ ssoProviders }: { ssoProviders: SsoLoginProvider[] }) {
    const form = useForm<z.input<typeof authFormInputSchemaZod>, unknown, z.output<typeof authFormInputSchemaZod>>({
        resolver: zodResolver(authFormInputSchemaZod)
    });

    const [errorMessages, setErrorMessages] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState<boolean>(false);
    const [authInput, setAuthInput] = useState<AuthFormInputSchema | undefined>(undefined);

    function redirectToProjects() {
        const currentUrl = window.location.href
        const url = new URL(currentUrl)
        url.pathname = '/'
        url.search = ''
        window.open(url.toString(), '_self')
    }

    const login = async (data: AuthFormInputSchema) => {
        setLoading(true);
        setErrorMessages(undefined);
        try {
            const authStatusResponse = await authUser(data);
            if (authStatusResponse.status !== 'success') {
                throw new Error(authStatusResponse.message);
            }
            if (!authStatusResponse.data) {
                throw new Error("Unknown error occured");
            }
            const authData = authStatusResponse.data as { email: string, twoFaEnabled: boolean };
            if (!authData.twoFaEnabled) {
                await signIn("credentials", {
                    username: data.email,
                    password: data.password,
                    redirect: false,
                });
                redirectToProjects()
            } else {
                setAuthInput(data); // 2fa window will be shown
            }
        } catch (e) {
            console.error(e);
            setErrorMessages((e as any).message);
        } finally {
            setLoading(false);
        }
    }

    if (authInput) {
        return <TwoFaAuthForm authData={authInput} />;
    }

    return (
        <Card className="w-full border-border/80 shadow-black/5">
            <Form {...form}>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    return form.handleSubmit(async (data) => {
                        await login(data);
                    })();
                }} className="space-y-6">

                    <CardContent className="space-y-5 pt-6">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>E-Mail</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            autoComplete="email"
                                            inputMode="email"
                                            placeholder="name@example.com"
                                            value={field.value as string | number | readonly string[] | undefined}
                                        />
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
                                        <Input
                                            type="password"
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
                                            {...field}
                                            value={field.value as string | number | readonly string[] | undefined}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        {errorMessages && (
                            <Alert variant="destructive" aria-live="polite">
                                <AlertDescription>{errorMessages}</AlertDescription>
                            </Alert>
                        )}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <LoadingSpinner /> : 'Sign in'}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
            {ssoProviders.length > 0 && (
                <CardFooter className="flex flex-col gap-4 pt-0">
                    <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
                        <Separator className="flex-1" />
                        <span>or continue with</span>
                        <Separator className="flex-1" />
                    </div>
                    {ssoProviders.map((provider) => (
                        <Button
                            key={provider.id}
                            variant="outline"
                            className="w-full"
                            type="button"
                            onClick={() => signIn(provider.id, { callbackUrl: "/" })}
                        >
                            <SsoProviderLogo type={provider.type} className="size-4" />
                            Continue with {provider.name}
                        </Button>
                    ))}
                </CardFooter>
            )}
        </Card>
    )
}
