import { Button } from "@/components/ui/button";
import { cn } from "@/frontend/utils/utils";
import { Check, Container, GitBranch, KeyRound, type LucideIcon } from "lucide-react";
import { SourceType } from "./types";

export function SourceTypeStep({ value, canUseGitSources, onChange }: {
    value: SourceType;
    canUseGitSources: boolean;
    onChange: (sourceType: SourceType) => void;
}) {
    const options: Array<{ value: SourceType; label: string; description: string; icon: LucideIcon; disabled?: boolean }> = [
        { value: 'GIT', label: 'Git HTTPS', description: 'Clone a Git repository over HTTPS.', icon: GitBranch, disabled: !canUseGitSources },
        { value: 'GIT_SSH', label: 'Git SSH', description: 'Use a deploy key for SSH repository access.', icon: KeyRound, disabled: !canUseGitSources },
        { value: 'CONTAINER', label: 'Docker Container Image', description: 'Deploy an existing image from a registry.', icon: Container },
    ];

    return (
        <div className="grid gap-3 md:grid-cols-3">
            {options.map((option) => (
                <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    disabled={option.disabled}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "flex h-auto min-h-32 flex-col items-start gap-3 p-4 text-left transition-colors",
                        value === option.value ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                        option.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
                    )}
                >
                    <span className="flex w-full items-center justify-between">
                        <option.icon className="h-5 w-5 text-muted-foreground" />
                        {value === option.value && <Check className="h-4 w-4 text-primary" />}
                    </span>
                    <span>
                        <span className="block font-medium">{option.label}</span>
                        <span className="mt-1 block whitespace-normal text-sm font-normal text-muted-foreground">{option.description}</span>
                    </span>
                </Button>
            ))}
        </div>
    );
}
