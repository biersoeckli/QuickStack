import type { AppExtendedModel } from '@/shared/model/app-extended.model';

export type WorkloadType = 'APP' | 'AGENT';
export type NetworkGraphNodeKind = WorkloadType | 'INTERNET';
export type NetworkGraphEdgeDirection = 'CONNECTION' | 'INGRESS' | 'EGRESS' | 'INTERNET_INGRESS' | 'INTERNET_EGRESS';

export type NetworkGraphNode = {
    id: string;
    kind: NetworkGraphNodeKind;
    name: string;
    projectId?: string;
    external: boolean;
    caption?: string;
};

export type NetworkGraphEdge = {
    id: string;
    source: string;
    target: string;
    direction: NetworkGraphEdgeDirection;
    labels: string[];
    external: boolean;
    complete?: boolean;
};

export type ProjectNetworkGraphData = { nodes: NetworkGraphNode[]; edges: NetworkGraphEdge[] };

function workloadNodeId(type: WorkloadType, id: string) {
    return `${type}:${id}`;
}

function formatRuleLabel(port: number, protocol: string) {
    return `${port}/${protocol.toUpperCase()}`;
}

function aggregateLabels(labels: string[]) {
    return Array.from(new Set(labels)).sort((a, b) => {
        const portA = parseInt(a, 10);
        const portB = parseInt(b, 10);
        return !Number.isNaN(portA) && !Number.isNaN(portB) ? portA - portB : a.localeCompare(b);
    });
}

function consolidateConnections(edges: NetworkGraphEdge[]) {
    const internetEdges = edges.filter(edge => edge.direction.startsWith('INTERNET'));
    const groups = new Map<string, { ingress: NetworkGraphEdge[]; egress: NetworkGraphEdge[] }>();
    for (const edge of edges.filter(edge => !edge.direction.startsWith('INTERNET'))) {
        const key = `${edge.source}:${edge.target}`;
        const group = groups.get(key) ?? { ingress: [], egress: [] };
        if (edge.direction === 'INGRESS') group.ingress.push(edge);
        else group.egress.push(edge);
        groups.set(key, group);
    }
    return [...internetEdges, ...Array.from(groups.entries()).map(([key, group]) => {
        const ingressLabels = aggregateLabels(group.ingress.flatMap(edge => edge.labels));
        const egressLabels = aggregateLabels(group.egress.flatMap(edge => edge.labels));
        const reference = group.egress[0] ?? group.ingress[0];
        return {
            id: `CONNECTION:${key}`,
            source: reference.source,
            target: reference.target,
            direction: 'CONNECTION' as const,
            labels: aggregateLabels([...ingressLabels, ...egressLabels]),
            external: reference.external,
            complete: ingressLabels.length > 0
                && ingressLabels.length === egressLabels.length
                && ingressLabels.every((label, index) => label === egressLabels[index]),
        };
    })];
}

/** Projects effective App Network Policy Configuration and App Domain traffic into graph facts. */
export function buildProjectNetworkGraph(apps: AppExtendedModel[]): ProjectNetworkGraphData {
    const projectId = apps[0]?.projectId;
    const internalAppIds = new Set(apps.map(app => app.id));
    const nodes = new Map<string, NetworkGraphNode>();
    const edges = new Map<string, NetworkGraphEdge>();
    const addNode = (node: NetworkGraphNode) => { if (!nodes.has(node.id)) nodes.set(node.id, node); };
    const addEdge = (source: string, target: string, direction: NetworkGraphEdgeDirection, label: string, external: boolean) => {
        const key = `${direction}:${source}:${target}`;
        const edge = edges.get(key);
        if (edge) edge.labels.push(label);
        else edges.set(key, { id: key, source, target, direction, labels: [label], external });
    };

    for (const app of apps) {
        const appNodeId = workloadNodeId('APP', app.id);
        addNode({ id: appNodeId, kind: 'APP', name: app.name, projectId: app.projectId, external: false });

        if (app.useNetworkPolicy) {
            for (const rule of app.appNetworkPolicy?.rules ?? []) {
                const target = rule.targetApp ?? rule.targetAgent;
                if (!target) continue;
                const targetType: WorkloadType = rule.targetApp ? 'APP' : 'AGENT';
                const targetNodeId = workloadNodeId(targetType, target.id);
                const external = targetType !== 'APP' || !internalAppIds.has(target.id);
                addNode({
                    id: targetNodeId, kind: targetType, name: target.name, projectId: target.projectId, external,
                    caption: external && target.projectId !== projectId ? 'Other project' : targetType === 'AGENT' ? 'Agent sandbox' : undefined,
                });
                const label = formatRuleLabel(rule.port, rule.protocol);
                if (rule.type === 'INGRESS') addEdge(targetNodeId, appNodeId, 'INGRESS', label, external);
                else addEdge(appNodeId, targetNodeId, 'EGRESS', label, external);
            }
            if (app.appNetworkPolicy?.allowInternetAccess !== false) {
                addNode({ id: 'INTERNET', kind: 'INTERNET', name: 'Internet', external: false });
                addEdge(appNodeId, 'INTERNET', 'INTERNET_EGRESS', '', false);
            }
        }

        if (app.appDomains.length > 0) {
            addNode({ id: 'INTERNET', kind: 'INTERNET', name: 'Internet', external: false });
            for (const domain of app.appDomains) addEdge('INTERNET', appNodeId, 'INTERNET_INGRESS', `${domain.hostname}:${domain.port}`, false);
        }
    }
    const rawEdges = Array.from(edges.values()).map(edge => ({ ...edge, labels: aggregateLabels(edge.labels) }));
    return { nodes: Array.from(nodes.values()), edges: consolidateConnections(rawEdges) };
}
