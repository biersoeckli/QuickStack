import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { JsFramework, jsFrameworkPresets } from "@/shared/model/js-framework.model";
import { ChevronDown, Cpu, Download, FolderOutput, FolderTree, Hammer, Play } from "lucide-react";
import Image from "next/image";
import { IconInput } from "./source-wizard-fields";
import { SourceWizardInput } from "./types";

export function FrameworkConfigurationStep({ framework, formData, onChange, onChangeFramework }: {
    framework: JsFramework;
    formData: SourceWizardInput;
    onChange: (patch: Partial<SourceWizardInput>) => void;
    onChangeFramework: () => void;
}) {
    const preset = jsFrameworkPresets[framework];
    const serverPreset = !!formData.runCommand?.trim();

    return (
        <div className="space-y-4 rounded-md border p-4">
            <div className="flex items-center gap-3 border-b pb-4">
                <Image src={preset.logoSrc} alt={`${preset.label} logo`} width={40} height={40} unoptimized className="size-10 shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{preset.label} preset</p>
                    <p className="text-xs text-muted-foreground">{serverPreset ? `Server preset · listens on port ${preset.defaultPort}` : 'Static preset · output is served by QuickStack'}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={onChangeFramework}>Change</Button>
            </div>
            <div className="space-y-3">
                <h3 className="text-sm font-semibold">Build</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <IconInput icon={Hammer} label="Build Command" className="font-mono text-sm" placeholder={preset.buildCommand} value={formData.buildCommand ?? ''} onChange={(event) => onChange({ buildCommand: event.target.value })} />
                    <div className="space-y-2">
                        <IconInput icon={Play} label="Run Command" className="font-mono text-sm" placeholder="Leave empty to serve static output" value={formData.runCommand ?? ''} onChange={(event) => onChange({ runCommand: event.target.value })} />
                       </div>
                </div>
            </div>
            <div className="space-y-3">
                <h3 className="text-sm font-semibold">Paths</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <IconInput icon={FolderTree} label="Root Directory" className="font-mono text-sm" placeholder="./" value={formData.rootDirectory ?? ''} onChange={(event) => onChange({ rootDirectory: event.target.value })} />
                    <IconInput icon={FolderOutput} label="Output Directory" className="font-mono text-sm" placeholder={preset.outputDirectory} value={formData.outputDirectory ?? ''} onChange={(event) => onChange({ outputDirectory: event.target.value })} />
                </div>
            </div>
            <Collapsible>
                <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="group -ml-2 text-muted-foreground hover:text-foreground" />}>
                    Build details <ChevronDown className="ml-1.5 size-4 transition-transform group-data-[panel-open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                    <div className="grid gap-4 md:grid-cols-2">
                        <IconInput icon={Download} label="Install Command" className="font-mono text-sm" value={formData.installCommand ?? ''} onChange={(event) => onChange({ installCommand: event.target.value })} />
                        <IconInput icon={Cpu} label="Node Version" className="font-mono text-sm" placeholder="lts" value={formData.nodeVersion ?? ''} onChange={(event) => onChange({ nodeVersion: event.target.value })} />
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
