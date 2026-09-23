import ErrorState from '@/components/custom/error-state';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
    return (
        <ErrorState
            icon={<FileQuestion className="text-muted-foreground" />}
            title="Page not found"
            description="The page you are looking for doesn't exist or may have been moved."
        />
    );
}
