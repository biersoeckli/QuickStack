'use client'

import { DeploymentStatus } from "@/shared/model/deployment-info.model";


export default function DeploymentStatusBadge(
    {
        children
    }: {
        children: DeploymentStatus
    }
) {

    return (<>
        <span className={'px-2 py-1 rounded-lg text-sm font-semibold ' + getBackgroundColorForStatus(children) + ' ' + getTextColorForStatus(children)}>{getTextForStatus(children)}</span>
    </>)
}

function getTextForStatus(status: DeploymentStatus) {
    switch (status) {
        case 'SHUTDOWN':
            return 'Shutdown';
        case 'BUILDING':
            return 'Building';
        case 'ERROR':
            return 'Error';
        case 'DEPLOYING':
            return 'Deploying';
        case 'DEPLOYED':
            return 'Deployed';
        default:
            return 'Unknown';
    }
}

function getBackgroundColorForStatus(status: DeploymentStatus) {
    switch (status) {

        case 'SHUTDOWN':
            return 'bg-slate-100';
        case 'ERROR':
            return 'bg-red-100';
        case 'BUILDING':
            return 'bg-blue-100';
        case 'DEPLOYING':
            return 'bg-blue-100';
        case 'DEPLOYED':
            return 'bg-green-100';
        default:
            return 'bg-slate-100';
    }
}

function getTextColorForStatus(status: DeploymentStatus) {
    switch (status) {

        case 'SHUTDOWN':
            return 'text-slate-800';
        case 'ERROR':
            return 'text-red-800';
        case 'BUILDING':
            return 'text-blue-800';
        case 'DEPLOYING':
            return 'text-blue-800';
        case 'DEPLOYED':
            return 'text-green-800';
        default:
            return 'text-slate-800';
    }
}