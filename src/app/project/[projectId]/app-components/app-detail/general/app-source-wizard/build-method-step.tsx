import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { Boxes, FileCode2, Package, type LucideIcon } from "lucide-react";

export function BuildMethodStep({ value, onChange }: {
    value: AppBuildMethod;
    onChange: (buildMethod: AppBuildMethod) => void;
}) {
    const options: Array<{ value: AppBuildMethod; label: string; description: string; icon: LucideIcon }> = [
        { value: 'FRAMEWORK', label: 'Framework', description: 'Deploy popular JS frameworks like Next.js, Nuxt.js, Angular and more.', icon: Boxes },
        { value: 'RAILPACK', label: 'Railpack', description: 'Detect and build the app automatically.', icon: Package },
        { value: 'DOCKERFILE', label: 'Dockerfile', description: 'Build with a Dockerfile from the repository.', icon: FileCode2 },
    ];

    return (<div>
        <Command className="rounded-2xl border">
            <CommandList>
                <CommandGroup>
                    {options.map((option) => (
                        <CommandItem
                            key={option.value}
                            value={option.value}
                            className="cursor-pointer"
                                data-checked={value === option.value}
                            onSelect={() => onChange(option.value)}
                        >
                            <option.icon className="mr-4 ml-1 h-4 w-4" />
                            <div className="min-w-0">
                                <p className="font-medium">{option.label}</p>
                                <p className="text-sm text-muted-foreground">{option.description}</p>
                            </div>
                            </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </Command>
    </div>);
}
