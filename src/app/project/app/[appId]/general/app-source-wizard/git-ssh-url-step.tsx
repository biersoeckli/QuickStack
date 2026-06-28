import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCopy, KeyRound, Link as LinkIcon, RefreshCw } from "lucide-react";
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
                <AlertTitle>Add this deploy key to your Git provider</AlertTitle>
                <AlertDescription>Some Git providers require a unique deploy key per repository. Regenerate the key if this key is already used elsewhere.</AlertDescription>
            </Alert>
            <IconInput
                icon={LinkIcon}
                label="Git SSH URL"
                placeholder="git@github.com:user/repo.git"
                value={formData.gitUrl ?? ''}
                onChange={(event) => onChange({ gitUrl: event.target.value, gitBranch: '' })}
            />
            {!!formData.gitUrl?.trim() && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <Label>Public Deploy Key</Label>
                        <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={onCopy} disabled={!publicKey}>
                                <ClipboardCopy className="h-4 w-4" />
                                Copy
                            </Button>
                            <Button type="button" size="sm" variant="secondary" onClick={onRegenerate} disabled={!publicKey}>
                                <RefreshCw className="h-4 w-4" />
                                Regenerate key
                            </Button>
                        </div>
                    </div>
                    <Textarea
                        readOnly
                        value={isEnsuringKey ? 'Generating deploy key...' : publicKey ?? ''}
                        className="min-h-28 font-mono text-xs"
                    />
                    <Label className="text-muted-foreground font-normal">Make sure to add the deploy key to your Git repository with read access.</Label>
                </div>
            )}
            <BranchLoadingState loading={isLoadingBranches} error={branchError} onRetry={onRetry} />
        </div>
    );
}
