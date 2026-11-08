import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { GitBranch } from "lucide-react";

export function GitBranchStep({ branches, selectedBranch, onSelect }: {
    branches: string[];
    selectedBranch: string;
    onSelect: (branch: string) => void;
}) {
    return (
        <div>
            <Command className="rounded-2xl border">
                <CommandInput placeholder="Search branches..." />
                <CommandList>
                    <CommandEmpty>No branches found.</CommandEmpty>
                    <CommandGroup>
                        {branches.map((branch) => (
                            <CommandItem
                                key={branch}
                                value={branch}
                                className="cursor-pointer"
                                data-checked={branch === selectedBranch}
                                onSelect={() => onSelect(branch)}
                            >
                                <GitBranch className="mr-2 h-4 w-4" />
                                <span className="truncate">{branch}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
        </div>
    );
}
