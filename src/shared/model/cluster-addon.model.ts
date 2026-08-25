export type AddonLifecycleStatus =
    | 'notInstalled'
    | 'installing'
    | 'ready'
    | 'updating'
    | 'uninstalling'
    | 'failed';

export type AddonMetadata = {
    id: string;
    displayName: string;
    description: string;
    documentationUrl: string;
    managedNamespaces: string[];
    canUninstall: boolean;
    updateWarning?: {
        title: string;
        items: string[];
    };
};

export type AddonRelease = {
    version: string;
    manifestUrl: string;
};

export type AddonStatus = {
    status: AddonLifecycleStatus;
    installedVersion?: string;
    message?: string;
};

export type AddonResourceOperation = {
    apiVersion?: string;
    kind: string;
    name: string;
    namespace?: string;
    status: 'succeeded' | 'failed';
    error?: string;
};

export type AddonOperationResult = {
    status: 'succeeded' | 'failed';
    release?: AddonRelease;
    resources: AddonResourceOperation[];
    error?: string;
};
