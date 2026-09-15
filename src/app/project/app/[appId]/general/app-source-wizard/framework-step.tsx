import { cn } from "@/frontend/utils/utils";
import { jsFrameworkOptions, JsFramework } from "@/shared/model/js-framework.model";
import { Check } from "lucide-react";
import Image from "next/image";

export function FrameworkStep({ value, onSelect }: {
    value: JsFramework | undefined;
    onSelect: (framework: JsFramework) => void;
}) {
    return (
        <div className="max-h-[360px] overflow-y-auto overscroll-contain p-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {jsFrameworkOptions.map((option) => {
                    const isSelected = value === option.id;

                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => onSelect(option.id)}
                            className={cn(
                                'relative flex aspect-square flex-col items-center justify-center gap-2 rounded-md border bg-card p-3 text-card-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                isSelected && 'border-primary ring-2 ring-primary ring-offset-2',
                            )}
                        >
                            <Image src={option.logoSrc} alt={`${option.label} logo`} width={48} height={48} unoptimized className="h-12 w-12 object-contain" />
                            <span className="text-sm font-medium">{option.label}</span>
                            {isSelected && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
