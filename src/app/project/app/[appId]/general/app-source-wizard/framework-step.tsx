import { cn } from "@/frontend/utils/utils";
import { jsFrameworkOptions, JsFramework } from "@/shared/model/js-framework.model";
import { Check } from "lucide-react";
import Image from "next/image";

export function FrameworkStep({ value, onSelect }: {
    value: JsFramework | undefined;
    onSelect: (framework: JsFramework) => void;
}) {
    return (
        <div className="max-h-[360px] overflow-y-auto overscroll-contain p-1">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {jsFrameworkOptions.map((option) => {
                    const isSelected = value === option.id;
                    const presetType = option.runCommand ? 'Server preset' : 'Static preset';

                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => onSelect(option.id)}
                            className={cn(
                                'relative flex min-h-28 items-center gap-3 rounded-lg border bg-card p-4 text-left text-card-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                isSelected && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                            )}
                        >
                            <Image src={option.logoSrc} alt={`${option.label} logo`} width={40} height={40} unoptimized className="size-10 shrink-0 object-contain" />
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{option.label}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">{presetType}</span>
                            </span>
                            {isSelected && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
