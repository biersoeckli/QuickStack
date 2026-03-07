'use client'

import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import { TooltipTrigger } from "@radix-ui/react-tooltip";

interface BackupStatusBadgeProps {
    missedBackup: boolean | undefined;
}

export default function BackupStatusBadge({ missedBackup }: BackupStatusBadgeProps) {
    if (missedBackup === undefined) {
        return null;
    }

    if (missedBackup) {
        return (
            <Tooltip>
                <TooltipTrigger>
                    <span className="px-2 py-1 rounded-lg text-sm font-semibold bg-orange-100 text-orange-800">
                        Warning
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="max-w-60">The backup schedule is configured, but it seems that a backup has not been created recently. This could indicate a problem with the backup process. Please check the backup configuration and logs to ensure that backups are running correctly.</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <span className="px-2 py-1 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
            OK
        </span>
    );
}
