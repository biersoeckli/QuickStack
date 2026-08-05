'use client'



import { BuildJobStatus } from "@/shared/model/build-job";


export default function BuildStatusBadge(
    {
        children
    }: {
        children: BuildJobStatus
    }
) {

    return (<>
        <span className={'px-2 py-1 rounded-lg text-sm font-semibold ' + getBackgroundColorForStatus(children) + ' ' + getTextColorForStatus(children)}>{getTextForStatus(children)}</span>

    </>)
}

function getTextForStatus(status: BuildJobStatus) {
    switch (status) {
        case 'UNKNOWN':
            return 'Unknown';
        case 'FAILED':
            return 'Failed';
        case 'RUNNING':
            return 'Running';
        case 'SUCCEEDED':
            return 'Success';
        default:
            return 'Unknown';
    }
}

function getBackgroundColorForStatus(status: BuildJobStatus) {
    switch (status) {

        case 'UNKNOWN':
            return 'bg-slate-100';
        case 'FAILED':
            return 'bg-red-100';
        case 'RUNNING':
            return 'bg-blue-100';
        case 'SUCCEEDED':
            return 'bg-green-100';
        default:
            return 'bg-slate-100';
    }
}

function getTextColorForStatus(status: BuildJobStatus) {
    switch (status) {

        case 'UNKNOWN':
            return 'text-slate-800';
        case 'FAILED':
            return 'text-red-800';
        case 'RUNNING':
            return 'text-blue-800';
        case 'SUCCEEDED':
            return 'text-green-800';
        default:
            return 'text-slate-800';
    }
}