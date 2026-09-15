import { CheckCircle2, FileCode2, Loader2, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconInput } from "./source-wizard-fields";
import { defaultDockerfilePath } from "./types";

export function DockerfilePathStep({ value, isDetecting, detectionResult, onChange, onRetry }: {
    value: string;
    isDetecting: boolean;
    detectionResult?: 'detected' | 'not-found' | null;
    onChange: (value: string) => void;
    onRetry?: () => void;
}) {
    return (
        <div className="space-y-4">
            {isDetecting && (
                <div className="flex min-h-20 items-center justify-center gap-2 rounded-md border text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Detecting Dockerfile...
                </div>
            )}
            {!isDetecting && detectionResult === 'detected' && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2"><CheckCircle2 className="size-4 shrink-0 text-emerald-600" />Dockerfile found at <code className="truncate font-mono">{value}</code></div>
                    {onRetry && <Button type="button" size="sm" variant="ghost" onClick={onRetry}><RefreshCw className="size-3.5" />Retry</Button>}
                </div>
            )}
            {!isDetecting && detectionResult === 'not-found' && (
                <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><SearchX className="size-4 shrink-0" />No Dockerfile found. Confirm or adjust the default path.</div>
                    {onRetry && <Button type="button" size="sm" variant="ghost" onClick={onRetry}><RefreshCw className="size-3.5" />Retry</Button>}
                </div>
            )}
            <IconInput
                icon={FileCode2}
                label="Dockerfile Path"
                placeholder={defaultDockerfilePath}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}
