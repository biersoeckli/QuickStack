import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function SettingsSection({
    id,
    title,
    icon: Icon,
    children,
}: {
    id: string;
    title: string;
    icon: LucideIcon;
    children: ReactNode;
}) {
    return (
        <section
            id={id}
            className="relative scroll-mt-4 space-y-3 pl-10 before:absolute before:inset-y-0 before:left-4 before:w-px before:bg-border"
        >
            <div className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground">
                <Icon className="size-4" />
            </div>
            <div className="space-y-0.5 pt-1">
                <h3 className="text-base font-semibold">{title}</h3>
            </div>
            <div className="space-y-8">
                {children}
            </div>
        </section>
    );
}
