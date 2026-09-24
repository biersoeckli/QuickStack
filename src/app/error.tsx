'use client';

import ErrorState from '@/components/custom/error-state';
import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <ErrorState
            icon={<CircleAlert />}
            mediaClassName="bg-destructive/10 text-destructive"
            title="Something went wrong"
            description="An unexpected error occurred while loading this page. You can try again, or return to the dashboard."
            digest={error.digest}
            onRetry={reset}
        />
    );
}
