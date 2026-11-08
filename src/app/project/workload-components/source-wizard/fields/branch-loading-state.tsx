import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

export function BranchLoadingState({ loading, error, onRetry }: {
    loading: boolean;
    error: string | null;
    onRetry: () => Promise<boolean>;
}) {
    if (loading) {
        return (
            <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading branches...
            </div>
        );
    }

    if (!error) {
        return null;
    }

    return (
        <Alert variant="destructive">
            <AlertTitle>Branches could not be loaded</AlertTitle>
            <AlertDescription className="space-y-3">
                <p>{error}</p>
                <Button type="button" variant="outline" onClick={onRetry}>
                    <RefreshCw className="h-4 w-4" />
                    Retry
                </Button>
            </AlertDescription>
        </Alert>
    );
}

