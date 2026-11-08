import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

export function SecretInput({ icon: Icon, label, value, visible, onVisibleChange, onChange }: {
    icon: LucideIcon;
    label: string;
    value: string;
    visible: boolean;
    onVisibleChange: (visible: boolean) => void;
    onChange: (value: string) => void;
}) {
    const EyeIcon = visible ? EyeOff : Eye;
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="relative">
                <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    className="pl-9 pr-10"
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => onVisibleChange(!visible)}
                >
                    <EyeIcon className="h-4 w-4" />
                    <span className="sr-only">{visible ? 'Hide secret' : 'Show secret'}</span>
                </Button>
            </div>
        </div>
    );
}

