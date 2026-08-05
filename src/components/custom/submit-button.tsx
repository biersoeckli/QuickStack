'use client'

import { useFormStatus } from "react-dom";
import LoadingSpinner from "../ui/loading-spinner";
import { Button } from "../ui/button";

export function SubmitButton(props: { children: React.ReactNode, className?: string }) {
    const { pending } = useFormStatus();
    return <Button type="submit" className={props.className} disabled={pending}>{pending ?<LoadingSpinner></LoadingSpinner> : props.children}</Button>
}
