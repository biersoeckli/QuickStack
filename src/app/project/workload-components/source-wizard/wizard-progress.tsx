import { cn } from "@/frontend/utils/utils";
import { SourceType, SourceWizardInput, StepId } from "./types";

export function WizardProgress({ step, formData }: { step: StepId; formData: SourceWizardInput }) {
    const steps = getProgressSteps(formData.sourceType as SourceType, formData.buildMethod);
    const currentIndex = Math.max(0, steps.findIndex((item) => item.id === step));
    const currentStep = steps[currentIndex];

    return (
        <div className="space-y-2">
            <div className="flex gap-2" aria-label={`Step ${currentIndex + 1} of ${steps.length}: ${currentStep.label}`}>
                {steps.map((item, index) => (
                    <div key={item.id} className="h-1.5 flex-1 rounded-full bg-muted">
                        <div className={cn("h-full rounded-full bg-primary transition-all", index <= currentIndex ? "w-full" : "w-0")} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function getProgressSteps(sourceType: SourceType, buildMethod?: string): Array<{ id: StepId; label: string }> {
    if (sourceType === 'CONTAINER') {
        return [{ id: 'source', label: 'Source' }, { id: 'container-image', label: 'Container image' }, { id: 'summary', label: 'Review' }];
    }
    const buildConfigSteps = buildMethod === 'FRAMEWORK'
        ? [{ id: 'framework-selection' as const, label: 'Framework' }, { id: 'framework-configuration' as const, label: 'Configure' }]
        : [{ id: 'dockerfile' as const, label: 'Dockerfile' }];
    return [
        { id: 'source', label: 'Source' },
        { id: sourceType === 'GIT' ? 'git-url' : 'ssh-url', label: 'Repository' },
        { id: 'branch', label: 'Branch' },
        { id: 'build-method', label: 'Build' },
        ...buildConfigSteps,
        { id: 'summary', label: 'Review' },
    ];
}
