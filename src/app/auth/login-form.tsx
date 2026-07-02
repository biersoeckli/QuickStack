'use client'

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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import TwoFaAuthForm from "./two-fa-auth"

export default function UserLoginForm() {
    const form = useForm<AuthFormInputSchema>({
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
        <Card className="w-[350px] mx-auto">
            <CardHeader>
                <CardTitle>Sign In</CardTitle>
                <CardDescription>Enter your email and password to access your account.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    return form.handleSubmit(async (data) => {
                        await login(data);
                    })();
                }} className="space-y-8">

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
                                        <Input type="password" {...field} value={field.value as string | number | readonly string[] | undefined} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <p className="text-red-500">{errorMessages}</p>
                        <Button type="submit" className="w-full" disabled={loading}>{loading ? <LoadingSpinner></LoadingSpinner> : 'Login'}</Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    )
}
