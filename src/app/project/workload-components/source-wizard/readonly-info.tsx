import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

export function ReadonlyInfo({ icon: Icon, label, value, action }: {
    icon?: LucideIcon;
    label: string;
    value: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border p-3">
            <div className="flex min-w-0 items-center gap-3">
                {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="truncate text-sm font-medium">{value}</p>
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
