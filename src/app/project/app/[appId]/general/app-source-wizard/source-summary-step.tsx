import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { SecretSummaryRow, SummaryRow } from "./source-wizard-fields";
import { buildMethodLabels, defaultDockerfilePath, SourceType, sourceTypeLabels, SourceWizardInput } from "./types";

export function SourceSummaryStep({ formData, publicKey, showGitToken, setShowGitToken, showRegistryPassword, setShowRegistryPassword }: {
    formData: SourceWizardInput;
    publicKey?: string;
    showGitToken: boolean;
    setShowGitToken: (show: boolean) => void;
    showRegistryPassword: boolean;
    setShowRegistryPassword: (show: boolean) => void;
}) {
    const isGitSource = formData.sourceType === 'GIT' || formData.sourceType === 'GIT_SSH';
    return (
        <div className="space-y-4 rounded-md border p-4">
            <SummaryRow label="Source Type" value={sourceTypeLabels[formData.sourceType as SourceType]} />
            {isGitSource && (
                <>
                    <SummaryRow label="Git URL" value={formData.gitUrl ?? ''} mono />
                    <SummaryRow label="Git Branch" value={formData.gitBranch ?? ''} />
                    <SummaryRow label="Build Method" value={buildMethodLabels[(formData.buildMethod as AppBuildMethod | undefined) ?? 'RAILPACK']} />
                    {formData.buildMethod === 'DOCKERFILE' && <SummaryRow label="Dockerfile Path" value={formData.dockerfilePath ?? defaultDockerfilePath} mono />}
                </>
            )}
            {formData.sourceType === 'GIT' && (
                <>
                    <SummaryRow label="Git Username" value={formData.gitUsername || 'Not configured'} />
                    <SecretSummaryRow label="Git Password or Token" value={formData.gitToken ?? ''} visible={showGitToken} onVisibleChange={setShowGitToken} />
                </>
            )}
            {formData.sourceType === 'GIT_SSH' && (
                <SummaryRow label="Deploy Key" value={publicKey ? 'Deploy key generated' : 'Not generated'} />
            )}
            {formData.sourceType === 'CONTAINER' && (
                <>
                    <SummaryRow label="Image Name" value={formData.containerImageSource ?? ''} mono />
                    <SummaryRow label="Registry Username" value={formData.containerRegistryUsername || 'Not configured'} />
                    <SecretSummaryRow label="Registry Password" value={formData.containerRegistryPassword ?? ''} visible={showRegistryPassword} onVisibleChange={setShowRegistryPassword} />
                </>
            )}
        </div>
    );
}
