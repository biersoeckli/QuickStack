import { AppExtendedModel } from "@/shared/model/app-extended.model";

export const GitTestRepositories = {
    publicHttpsUrl: 'https://github.com/biersoeckli/dummy-node-app.git',
    publicSshUrl: 'git@github.com:biersoeckli/dummy-node-app.git',
    privateSshUrl: 'git@github.com:biersoeckli/dummy-node-app-private.git',
    branch: 'main',
} as const;

export const GitTestEnvironment = {
    privateSshKey: 'INTEGRATION_TEST_GIT_PRIVATE_SSH_KEY'
} as const;

export function getPrivateGitSshKeyFromEnv() {
    return process.env[GitTestEnvironment.privateSshKey]?.replace(/\\n/g, '\n').trim();
}

export function createGitApp(input: Pick<AppExtendedModel, 'id' | 'sourceType' | 'gitUrl'>): AppExtendedModel {
    return {
        id: input.id,
        name: input.id,
        appType: 'APP',
        projectId: 'proj-git-service-integration',
        sourceType: input.sourceType,
        buildMethod: 'RAILPACK',
        gitUrl: input.gitUrl,
        gitBranch: GitTestRepositories.branch,
        dockerfilePath: './Dockerfile',
        replicas: 1,
        envVars: '',
        ingressNetworkPolicy: 'ALLOW_ALL',
        egressNetworkPolicy: 'ALLOW_ALL',
        useNetworkPolicy: true,
        healthCheckPeriodSeconds: 15,
        healthCheckTimeoutSeconds: 5,
        healthCheckFailureThreshold: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        project: {
            id: 'proj-git-service-integration',
            name: 'Git Service Integration',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        appDomains: [],
        appPorts: [],
        appFileMounts: [],
        appVolumes: [],
        appBasicAuths: [],
    } as AppExtendedModel;
}