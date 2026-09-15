import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ClipboardCopy, KeyRound, Link as LinkIcon, RefreshCw } from "lucide-react";
import { BranchLoadingState, IconInput } from "./source-wizard-fields";
import { SourceFormPatch, SourceWizardInput } from "./types";

export function GitSshUrlStep({ formData, publicKey, isEnsuringKey, isLoadingBranches, branchError, onChange, onCopy, onRegenerate, onRetry }: {
    formData: SourceWizardInput;
    publicKey?: string;
    isEnsuringKey: boolean;
    isLoadingBranches: boolean;
    branchError: string | null;
    onChange: (patch: SourceFormPatch) => void;
    onCopy: () => void;
    onRegenerate: () => void;
    onRetry: () => Promise<boolean>;
}) {
    return (
        <div className="space-y-4">
            <Alert>
                <KeyRound className="h-4 w-4" />
                <AlertTitle>Connect a private repository in four steps</AlertTitle>
                <AlertDescription>QuickStack uses this read-only deploy key to clone the repository.</AlertDescription>
            </Alert>
            <div className="space-y-3 rounded-md border p-4">
                <div className="flex gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">1</span>
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <Label>Copy the deploy key</Label>
                            <div className="flex gap-2">
                                <Button type="button" size="sm" variant="outline" onClick={onCopy} disabled={!publicKey}>
                                    <ClipboardCopy className="h-4 w-4" />
                                    Copy
                                </Button>
                                <Button type="button" size="sm" variant="secondary" onClick={onRegenerate} disabled={!publicKey}>
                                    <RefreshCw className="h-4 w-4" />
                                    Regenerate
                                </Button>
                            </div>
                        </div>
                        <Textarea readOnly value={isEnsuringKey ? 'Generating deploy key...' : publicKey ?? ''} className="min-h-24 font-mono text-xs" />
                    </div>
                </div>
                <div className="flex gap-3 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium">2</span>
                    <p>Add it to the repository in your Git provider with read-only access.</p>
                </div>
                <div className="flex gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium">3</span>
                    <div className="min-w-0 flex-1">
                        <IconInput icon={LinkIcon} label="Paste the Git SSH URL" placeholder="git@github.com:user/repo.git" value={formData.gitUrl ?? ''} onChange={(event) => onChange({ gitUrl: event.target.value, gitBranch: '' })} />
                    </div>
                </div>
                <div className="flex gap-3 text-sm text-muted-foreground">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium"><Check className="size-3" /></span>
                    <p>Continue to verify access and choose a branch.</p>
                </div>
            </div>
            <BranchLoadingState loading={isLoadingBranches} error={branchError} onRetry={onRetry} />
        </div>
    );
}
