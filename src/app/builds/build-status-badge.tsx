'use client'

import { BuildJobStatus } from "@/shared/model/build-job";

export default function BuildStatusBadge({ children }: { children: BuildJobStatus }) {
    return (
        <span className={`px-2 py-1 rounded-lg text-sm font-semibold ${getBackgroundColor(children)} ${getTextColor(children)}`}>
            {getLabel(children)}
        </span>
    );
}

function getLabel(status: BuildJobStatus) {
    switch (status) {
        case 'RUNNING': return 'Running';
        case 'PENDING': return 'Pending';
        case 'SUCCEEDED': return 'Succeeded';
        case 'FAILED': return 'Failed';
        default: return 'Unknown';
    }
}

function getBackgroundColor(status: BuildJobStatus) {
    switch (status) {
        case 'RUNNING': return 'bg-blue-100';
        case 'PENDING': return 'bg-yellow-100';
        case 'SUCCEEDED': return 'bg-green-100';
        case 'FAILED': return 'bg-red-100';
        default: return 'bg-slate-100';
    }
}

function getTextColor(status: BuildJobStatus) {
    switch (status) {
        case 'RUNNING': return 'text-blue-800';
        case 'PENDING': return 'text-yellow-800';
        case 'SUCCEEDED': return 'text-green-800';
        case 'FAILED': return 'text-red-800';
        default: return 'text-slate-800';
    }
}
