import { JsFramework, jsFrameworkPresets } from "@/shared/model/js-framework.model";
import { Cpu, Download, FolderOutput, FolderTree, Hammer, Play } from "lucide-react";
import { IconInput } from "./source-wizard-fields";
import { SourceWizardInput } from "./types";

export function FrameworkConfigurationStep({ framework, formData, onChange }: {
    framework: JsFramework;
    formData: SourceWizardInput;
    onChange: (patch: Partial<SourceWizardInput>) => void;
}) {
    const preset = jsFrameworkPresets[framework];

    return (
        <div className="space-y-4 rounded-md border p-4">
            <p className="text-sm text-muted-foreground">
                QuickStack runs a Railpack build with these commands. Adjust them to match your project.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
                <IconInput icon={Download} label="Install Command" value={formData.installCommand ?? ''} onChange={(event) => onChange({ installCommand: event.target.value })} />
                <IconInput icon={Hammer} label="Build Command" placeholder={preset.buildCommand} value={formData.buildCommand ?? ''} onChange={(event) => onChange({ buildCommand: event.target.value })} />
                <IconInput icon={Play} label="Run Command" placeholder="Leave empty to serve static output" value={formData.runCommand ?? ''} onChange={(event) => onChange({ runCommand: event.target.value })} />
                <IconInput icon={Cpu} label="Node Version" placeholder="lts" value={formData.nodeVersion ?? ''} onChange={(event) => onChange({ nodeVersion: event.target.value })} />
                <IconInput icon={FolderTree} label="Root Directory" placeholder="./" value={formData.rootDirectory ?? ''} onChange={(event) => onChange({ rootDirectory: event.target.value })} />
                <IconInput icon={FolderOutput} label="Output Directory" placeholder={preset.outputDirectory} value={formData.outputDirectory ?? ''} onChange={(event) => onChange({ outputDirectory: event.target.value })} />
            </div>
            <p className="text-sm text-muted-foreground">
                {formData.runCommand?.trim()
                    ? `Recommended app port: ${preset.defaultPort}.`
                    : 'Without a run command QuickStack serves the output directory as a static site.'}
            </p>
        </div>
    );
}
