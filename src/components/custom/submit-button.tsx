'use client'

import { useFormStatus } from "react-dom";
import LoadingSpinner from "../ui/loading-spinner";
import { Button } from "../ui/button";

export function SubmitButton(props: {
    children: React.ReactNode,
    variant?: "default" | "destructive" | "ghost" | "link" | "outline" | "secondary" | null | undefined,
    className?: string
}) {
    const { pending } = useFormStatus();
    return <Button type="submit" variant={props.variant} className={props.className} disabled={pending}>{pending ? <LoadingSpinner></LoadingSpinner> : props.children}</Button>
}
