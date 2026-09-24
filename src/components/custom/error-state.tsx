'use client';

import { Button } from '@/components/ui/button';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/frontend/utils/utils';
import { Home, RotateCw } from 'lucide-react';

export default function ErrorState({
    icon,
    title,
    description,
    mediaClassName,
    digest,
    onRetry,
    homeHref = '/',
}: {
    icon: React.ReactNode;
    title: string;
    description: React.ReactNode;
    mediaClassName?: string;
    digest?: string;
    onRetry?: () => void;
    homeHref?: string;
}) {
    return (
        <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
            <Empty className="max-w-md border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon" className={cn(mediaClassName)}>
                        {icon}
                    </EmptyMedia>
                    <EmptyTitle>{title}</EmptyTitle>
                    <EmptyDescription>{description}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {onRetry && (
                            <Button variant="outline" onClick={onRetry}>
                                <RotateCw />
                                Try again
                            </Button>
                        )}
                        <Button
                            render={
                                <a href={homeHref}>
                                    <Home />
                                    Back to home
                                </a>
                            }
                        />
                    </div>
                    {digest && (
                        <p className="text-xs text-muted-foreground/70">
                            Digest: <span className="font-mono">{digest}</span>
                        </p>
                    )}
                </EmptyContent>
            </Empty>
        </div>
    );
}
