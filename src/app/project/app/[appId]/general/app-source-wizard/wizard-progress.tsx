import { cn } from "@/frontend/utils/utils";
import { SourceType, SourceWizardInput, StepId } from "./types";

export function WizardProgress({ step, formData }: { step: StepId; formData: SourceWizardInput }) {
    const steps = getProgressSteps(formData.sourceType as SourceType);
    const currentIndex = Math.max(0, steps.findIndex((item) => item.id === step));

    return (
        <div className="flex gap-2">
            {steps.map((item, index) => (
                <div key={item.id} className="h-1.5 flex-1 rounded-full bg-muted">
                    <div className={cn("h-full rounded-full bg-primary transition-all", index <= currentIndex ? "w-full" : "w-0")} />
                </div>
            ))}
        </div>
    );
}

function getProgressSteps(sourceType: SourceType): Array<{ id: StepId }> {
    if (sourceType === 'CONTAINER') {
        return [{ id: 'source' }, { id: 'container-image' }, { id: 'summary' }];
    }
    return [{ id: 'source' }, { id: sourceType === 'GIT' ? 'git-url' : 'ssh-url' }, { id: 'branch' }, { id: 'build-method' }, { id: 'dockerfile' }, { id: 'summary' }];
}
