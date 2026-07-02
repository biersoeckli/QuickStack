'use client'

import type { ComponentPropsWithoutRef } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/frontend/utils/utils";

const storageClassDescriptions: Record<string, string> = {
    longhorn: "Distributed, replicated storage recommended workloads in a cluster of multiple nodes.",
    "local-path": "Node-local volumes, no replication. Data is stored on the master node. Only works in a single node setup.",
};

function toStorageClassOption(storageClassName: string) {
    return {
        label: storageClassName === "longhorn" ? "Longhorn" : storageClassName === "local-path" ? "Local Path" : storageClassName,
        value: storageClassName,
        description: storageClassDescriptions[storageClassName],
    };
}

export default function StorageClassCombobox({
    value,
    storageClasses,
    disabled,
    onChange,
    ...triggerProps
}: {
    value?: string | null;
    storageClasses: string[];
    disabled?: boolean;
    onChange: (value: string) => void;
} & Pick<ComponentPropsWithoutRef<"button">, "id" | "aria-describedby" | "aria-invalid">) {
    const storageClassOptions = Array.from(new Set(storageClasses)).map(toStorageClassOption);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                        "w-full justify-between",
                        !value && "text-muted-foreground"
                    )}
                    disabled={disabled || storageClassOptions.length === 0}
                    {...triggerProps}
                >
                    {storageClassOptions.length === 0
                        ? "No storage classes found"
                        : value
                            ? storageClassOptions.find((storageClass) => storageClass.value === value)?.label ?? value
                            : "Select storage class"}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="max-w-[280px] p-0">
                <Command>
                    <CommandList>
                        <CommandGroup>
                            {storageClassOptions.length === 0 && (
                                <CommandItem value="__no-storage-classes" disabled>No storage classes found</CommandItem>
                            )}
                            {storageClassOptions.map((storageClass) => (
                                <CommandItem
                                    value={storageClass.label}
                                    key={storageClass.value}
                                    onSelect={() => onChange(storageClass.value)}
                                >
                                    <div className="flex flex-col gap-1">
                                        <span>{storageClass.label}</span>
                                        {storageClass.description && <span className="text-xs text-muted-foreground">{storageClass.description}</span>}
                                    </div>
                                    <Check
                                        className={cn(
                                            "ml-auto",
                                            storageClass.value === value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
