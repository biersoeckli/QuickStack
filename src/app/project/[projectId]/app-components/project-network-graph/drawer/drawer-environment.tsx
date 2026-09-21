'use client';

import { Copy, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { EnvVarUtils } from '@/shared/utils/env-var.utils';
import { toast } from 'sonner';

type EnvironmentVariable = {
    name: string;
    value: string;
};

function VariableList({
    title,
    variables,
}: {
    title: string;
    variables: EnvironmentVariable[];
}) {
    const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-medium">{title}</h4>
            {variables.length === 0 ? (
                <p className="text-sm text-muted-foreground">None configured.</p>
            ) : (
                <div className="divide-y rounded-2xl border">
                    {variables.map((variable, index) => {
                        const variableId = `${variable.name}-${index}`;
                        const isVisible = visibleValues.has(variableId);

                        return (
                            <div
                                key={variableId}
                                className="group flex items-center gap-3 px-3 py-2"
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-1">
                                    <code className="min-w-0 truncate text-xs font-medium">
                                        {variable.name}
                                    </code>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="pointer-events-none size-6 shrink-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                                        title="Copy variable name"
                                        onClick={() => {
                                            void navigator.clipboard.writeText(
                                                variable.name,
                                            );
                                            toast.success('Variable name copied');
                                        }}
                                    >
                                        <Copy className="size-3.5" />
                                        <span className="sr-only">
                                            Copy variable name
                                        </span>
                                    </Button>
                                </div>
                                <code className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
                                    {isVisible ? variable.value : '••••••••'}
                                </code>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 shrink-0"
                                    onClick={() =>
                                        setVisibleValues((current) => {
                                            const next = new Set(current);
                                            if (next.has(variableId)) {
                                                next.delete(variableId);
                                            } else {
                                                next.add(variableId);
                                            }
                                            return next;
                                        })
                                    }
                                >
                                    {isVisible ? (
                                        <EyeOff className="size-3.5" />
                                    ) : (
                                        <Eye className="size-3.5" />
                                    )}
                                    <span className="sr-only">
                                        {isVisible ? 'Hide value' : 'Show value'}
                                    </span>
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function DrawerEnvironment({
    app,
    onEdit,
}: {
    app: AppExtendedModel;
    onEdit: () => void;
}) {
    return (
        <div className="space-y-6">
            <VariableList
                title="Environment variables"
                variables={EnvVarUtils.parseEnvVariables(app)}
            />
            <VariableList
                title="Build arguments"
                variables={EnvVarUtils.parseBuildArgs(app)}
            />
            <Button type="button" variant="outline" onClick={onEdit}>
                Edit variables
            </Button>
        </div>
    );
}
