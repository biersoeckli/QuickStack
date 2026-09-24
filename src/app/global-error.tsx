'use client';

import ErrorState from '@/components/custom/error-state';
import { cn } from '@/frontend/utils/utils';
import { TriangleAlert } from 'lucide-react';
import { Inter } from 'next/font/google';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
});

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body
                className={cn(
                    'min-h-screen bg-background font-sans antialiased',
                    inter.variable
                )}
            >
                <ErrorState
                    icon={<TriangleAlert />}
                    mediaClassName="bg-destructive/10 text-destructive"
                    title="Something went wrong"
                    description="A critical error occurred. Please try again, or reload the page to get back to the dashboard."
                    digest={error.digest}
                    onRetry={reset}
                />
            </body>
        </html>
    );
}
