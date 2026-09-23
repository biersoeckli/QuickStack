import ErrorState from '@/components/custom/error-state';
import { TriangleAlert } from 'lucide-react';

export default function ErrorPage() {
    return (
        <ErrorState
            icon={<TriangleAlert />}
            mediaClassName="bg-destructive/10 text-destructive"
            title="Something went wrong"
            description="An unexpected error occurred. Please try again or return to the dashboard."
        />
    );
}
