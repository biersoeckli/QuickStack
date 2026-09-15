import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { jsFrameworkOptions, JsFramework, jsFrameworkPresets } from "@/shared/model/js-framework.model";
import { Check, Cpu, Download, FolderOutput, FolderTree, Hammer, Play } from "lucide-react";
import { IconInput } from "./source-wizard-fields";
import { SourceWizardInput } from "./types";

export function FrameworkStep({ value, formData, onChange, onSelect }: {
    value: JsFramework | undefined;
    formData: SourceWizardInput;
    onChange: (patch: Partial<SourceWizardInput>) => void;
    onSelect: (framework: JsFramework) => void;
}) {
    return (
        <div className="space-y-4">
            <Command className="rounded-md border">
                <CommandList>
                    <CommandGroup>
                        {jsFrameworkOptions.map((option) => (
                            <CommandItem
                                key={option.id}
                                value={option.id}
                                className="cursor-pointer"
                                onSelect={() => onSelect(option.id)}
                            >
                                <div className="min-w-0">
                                    <p className="font-medium">{option.label}</p>
                                    <p className="text-sm text-muted-foreground">{option.description}</p>
                                </div>
                                <Check className={value === option.id ? 'ml-auto h-4 w-4' : 'ml-auto h-4 w-4 opacity-0'} />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>

            {value && (
                <div className="space-y-4 rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">
                        QuickStack runs a Railpack build with these commands. Adjust them to match your project.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                        <IconInput
                            icon={Download}
                            label="Install Command"
                            placeholder="Auto-detected from lockfile"
                            value={formData.installCommand ?? ''}
                            onChange={(event) => onChange({ installCommand: event.target.value })}
                        />
                        <IconInput
                            icon={Hammer}
                            label="Build Command"
                            placeholder={jsFrameworkPresets[value].buildCommand}
                            value={formData.buildCommand ?? ''}
                            onChange={(event) => onChange({ buildCommand: event.target.value })}
                        />
                        <IconInput
                            icon={Play}
                            label="Run Command"
                            placeholder="Leave empty to serve static output"
                            value={formData.runCommand ?? ''}
                            onChange={(event) => onChange({ runCommand: event.target.value })}
                        />
                        <IconInput
                            icon={Cpu}
                            label="Node Version"
                            placeholder="lts"
                            value={formData.nodeVersion ?? ''}
                            onChange={(event) => onChange({ nodeVersion: event.target.value })}
                        />
                        <IconInput
                            icon={FolderTree}
                            label="Root Directory"
                            placeholder="./"
                            value={formData.rootDirectory ?? ''}
                            onChange={(event) => onChange({ rootDirectory: event.target.value })}
                        />
                        <IconInput
                            icon={FolderOutput}
                            label="Output Directory"
                            placeholder={jsFrameworkPresets[value].outputDirectory}
                            value={formData.outputDirectory ?? ''}
                            onChange={(event) => onChange({ outputDirectory: event.target.value })}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {formData.runCommand?.trim()
                            ? `Recommended app port: ${jsFrameworkPresets[value].defaultPort}.`
                            : 'Without a run command QuickStack serves the output directory as a static site.'}
                    </p>
                </div>
            )}
        </div>
    );
}
