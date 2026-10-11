vi.mock('./network-policy.service', () => ({
    default: {
        buildAgentSandboxTemplateNetworkPolicy: vi.fn(),
    },
}));

vi.mock('../adapter/kubernetes-api.adapter', () => ({
    default: {},
    kubernetesPatchOptions: vi.fn(),
}));

import agentSandboxTemplateBuilder from './agent-sandbox-template-builder.service';

const agent = {
    id: 'agent-1',
    projectId: 'project-1',
    containerImageSource: 'registry.example/agent:latest',
    deployFileBrowser: true,
    healthCheckPeriodSeconds: 10,
    healthCheckTimeoutSeconds: 5,
    healthCheckFailureThreshold: 3,
    agentDomains: [],
};

describe('AgentSandboxTemplateBuilder', () => {

    it('derives a SandboxTemplate from an Agent Sandbox Manifest input', () => {
        const resource = agentSandboxTemplateBuilder.buildSandboxTemplateResource({
            agent,
            volumePvcData: [],
            perSandboxVolumes: [],
            fileVolumes: [],
            fileVolumeMounts: [],
        });

        expect(resource.metadata?.name).toBe('agent-1');
        expect(resource.metadata?.namespace).toBe('project-1');
        expect(resource.spec.podTemplate.spec.containers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'agent',
                image: 'registry.example/agent:latest',
                workingDir: '/workspace',
            }),
            expect.objectContaining({
                name: 'filebrowser',
                volumeMounts: [{ name: 'workspace', mountPath: '/srv' }],
            }),
        ]));
    });

    it('uses the deployment image override without copying Agent fields into the caller', () => {
        const resource = agentSandboxTemplateBuilder.buildSandboxTemplateResource({
            agent,
            containerImageSource: 'registry.example/deployed:sha',
            volumePvcData: [],
            perSandboxVolumes: [],
            fileVolumes: [],
            fileVolumeMounts: [],
        });

        expect(resource.spec.podTemplate.spec.containers[0].image).toBe('registry.example/deployed:sha');
    });
});
