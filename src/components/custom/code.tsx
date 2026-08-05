'use client'

import { toast } from "sonner";

export function Code({ children, copieable = true, copieableValue, className }: { children: string | null | undefined, copieable?: boolean, copieableValue?: string, className?: string }) {
    return (children &&
        <code className={(className ?? '') + ' relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold ' + (copieable ? 'cursor-pointer' : '')}
            onClick={() => {
                if (!copieable) return;
                navigator.clipboard.writeText(copieableValue || children || '');
                toast.success('Copied to clipboard');
            }}>
            {children}
        </code>
    )
}