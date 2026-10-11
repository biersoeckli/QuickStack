export const agentDrawerTabValues = [
    'sandboxes',
    'builds',
    'configuration',
] as const;

export type AgentDrawerTab = (typeof agentDrawerTabValues)[number];

export const defaultAgentDrawerTab: AgentDrawerTab = 'sandboxes';

export class AgentDrawerNavigationUtils {
    static resolveTab(
        requestedTab: string | null | undefined,
        options: { readonly: boolean; hasGitSource: boolean },
    ): AgentDrawerTab {
        if (!agentDrawerTabValues.includes(requestedTab as AgentDrawerTab)) return defaultAgentDrawerTab;
        if (requestedTab === 'builds' && (options.readonly || !options.hasGitSource)) return defaultAgentDrawerTab;
        if (requestedTab === 'configuration' && options.readonly) return defaultAgentDrawerTab;
        return requestedTab as AgentDrawerTab;
    }
}
