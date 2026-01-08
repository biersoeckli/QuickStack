'use client';

import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, Node, Edge, MarkerType, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { App, AppDomain, AppPort } from '@prisma/client';
import { Globe, Network, Lock, Cloud, Shield, ArrowDown, HeartPulse } from 'lucide-react';
import PodStatusIndicator from '@/components/custom/pod-status-indicator';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AppWithRelations extends App {
    appPorts: AppPort[];
    appDomains: AppDomain[];
}

interface ProjectNetworkGraphProps {
    apps: AppWithRelations[];
}

const PolicyIcon = ({ policy, type, ports, useNetworkPolicy }: { policy: string, type: 'ingress' | 'egress', ports: string, useNetworkPolicy: boolean }) => {
    let Icon = Globe;
    let color = type === 'egress' ? 'text-blue-500' : 'text-green-500';
    let title = policy;

    switch (policy) {
        case 'ALLOW_ALL':
            Icon = Globe;
            color = 'text-green-500';
            break;
        case 'NAMESPACE_ONLY':
            Icon = Network;
            color = 'text-blue-500';
            break;
        case 'DENY_ALL':
            Icon = Lock;
            color = 'text-red-500';
            break;
        case 'INTERNET_ONLY':
            Icon = Cloud;
            color = 'text-orange-500';
            break;
        default:
            Icon = Shield;
            color = 'text-gray-500';
    }

    return (
        <div className='flex items-center gap-2'>
            {useNetworkPolicy && <div className={`p-1 bg-white rounded-full border shadow-sm ${color}`} title={`${type}: ${title}`}>
                <div className=' flex gap-1 items-center'>
                    <Icon size={16} />
                </div>
            </div>}
            {ports && type === 'ingress' && <div className={`p-1 px-2 bg-white rounded-full border shadow-sm text-xs text-gray-500`} title={`${type}: ${title}`}>
                {ports}
            </div>}
        </div>
    );
};

const AppNode = ({ data }: { data: {
    label: string;
    ingressPolicy: string;
    egressPolicy: string;
    appId: string;
    app: AppWithRelations;
    ports: string;
} }) => {
    return (
        <div className="relative bg-white border border-slate-300 rounded-md p-4 min-w-[150px] shadow-sm text-center cursor-pointer hover:border-slate-400 transition-colors">
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />

            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <PolicyIcon policy={data.ingressPolicy} ports={data.ports} useNetworkPolicy={data.app.useNetworkPolicy} type="ingress" />
            </div>

            <div className="font-semibold text-sm mt-2 mb-2 flex gap-2 items-center justify-center">
                <PodStatusIndicator appId={data.appId} /> <p>{data.label}</p>
                {data.app.healthChechHttpGetPath &&   <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <HeartPulse size={16} className="text-blue-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Healthchecks enabled for this App</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>}
            </div>

            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
                <PolicyIcon policy={data.egressPolicy} ports={data.ports} useNetworkPolicy={data.app.useNetworkPolicy} type="egress" />
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
        </div>
    );
};

const nodeTypes = {
    appNode: AppNode,
};

const Legend = () => {
    return (
        <div className="mt-4 p-4 border rounded-md bg-slate-50 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h4 className="font-medium mb-1 text-xs uppercase text-slate-500 pb-2">Node Layout</h4>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 border border-slate-300 rounded bg-white relative mx-1">
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-200 rounded-full border border-slate-300"></div>
                        </div>
                        <span>Top Icon: <strong>Ingress Policy</strong> (Incoming traffic)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 border border-slate-300 rounded bg-white relative mx-1">
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-200 rounded-full border border-slate-300"></div>
                        </div>
                        <span>Bottom Icon: <strong>Egress Policy</strong> (Outgoing traffic)</span>
                    </div>
                </div>
                <div>
                    <h4 className="font-medium mb-1 text-xs uppercase text-slate-500 pb-2">Network Policy Types</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                            <Globe size={16} className="text-green-500" />
                            <span>Allow All</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Network size={16} className="text-blue-500" />
                            <span>Project Only</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Cloud size={16} className="text-orange-500" />
                            <span>Internet Only</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Lock size={16} className="text-red-500" />
                            <span>Deny All</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function ProjectNetworkGraph({ apps }: ProjectNetworkGraphProps) {
    const router = useRouter();
    const { nodes, edges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Separate apps with domains and without domains
        const appsWithDomains = apps.filter(app => app.appDomains.length > 0);
        const appsWithoutDomains = apps.filter(app => app.appDomains.length === 0);

        const nodeSpacing = 250; // Horizontal spacing between nodes
        const rowSpacing = 150; // Vertical spacing between rows
        const internetY = 100;
        const firstRowY = internetY + 200;
        const secondRowY = firstRowY + rowSpacing;

        // Check if we need an Internet node
        const hasInternetAccess = appsWithDomains.length > 0;
        const internetX = (Math.max(appsWithDomains.length, appsWithoutDomains.length) * nodeSpacing) / 2;

        if (hasInternetAccess) {
            nodes.push({
                id: 'INTERNET',
                position: { x: internetX, y: internetY },
                data: { label: 'Internet' },
                style: { background: '#e0e0e0', border: '1px solid #777', padding: 10, borderRadius: '50%', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
                type: 'input', // It's a source only
            });
        }

        // First row: Apps with domains (internet accessible)
        appsWithDomains.forEach((app, index) => {
            const totalWidth = (appsWithDomains.length - 1) * nodeSpacing;
            const startX = internetX - (totalWidth / 2);
            const x = startX + (index * nodeSpacing);
            const y = firstRowY;

            const ports = Array.from(new Set([
                ...app.appDomains,
                ...app.appPorts
            ].map(d => d.port))).join(', ');

            nodes.push({
                id: app.id,
                position: { x, y },
                data: {
                    label: app.name,
                    ingressPolicy: app.ingressNetworkPolicy,
                    egressPolicy: app.egressNetworkPolicy,
                    appId: app.id,
                    app,
                    ports
                },
                type: 'appNode',
            });

            // Edge from Internet to App
            const hostnames = app.appDomains.map(d => d.hostname).join(', ');
            edges.push({
                id: `INTERNET-${app.id}`,
                source: 'INTERNET',
                target: app.id,
                label: `${hostnames}`,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                },
                animated: true,
                style: { stroke: '#000' },
            });
        });

        // Second row: Apps without domains (not internet accessible)
        appsWithoutDomains.forEach((app, index) => {
            const totalWidth = (appsWithoutDomains.length - 1) * nodeSpacing;
            const startX = internetX - (totalWidth / 2);
            const x = startX + (index * nodeSpacing);
            const y = secondRowY;

            const ports = Array.from(new Set([
                ...app.appDomains,
                ...app.appPorts
            ].map(d => d.port))).join(', ');

            nodes.push({
                id: app.id,
                position: { x, y },
                data: {
                    label: app.name,
                    ingressPolicy: app.ingressNetworkPolicy,
                    egressPolicy: app.egressNetworkPolicy,
                    appId: app.id,
                    app,
                    ports
                },
                type: 'appNode',
            });
        });

        return { nodes, edges };
    }, [apps]);
    return (
        <div className="space-y-4">
            <div style={{ height: 600, border: '1px solid #eee', borderRadius: 8 }}>
                <ReactFlow
                    defaultNodes={nodes}
                    defaultEdges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    onNodeClick={(event, node) => {
                        if (node.id !== 'INTERNET') {
                            router.push(`/project/app/${node.id}`);
                        }
                    }}
                >
                    {/* <Background />
                    <Controls />*/}
                </ReactFlow>
            </div>
            <Legend />
        </div>
    );
}
