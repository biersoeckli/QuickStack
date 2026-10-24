import {
    AgentDrawerNavigationUtils,
    defaultAgentDrawerTab,
} from './agent-drawer-navigation.utils';

describe('AgentDrawerNavigationUtils.resolveTab', () => {
    test.each([
        ['sandboxes', { readonly: false, hasGitSource: false }, 'sandboxes'],
        ['builds', { readonly: false, hasGitSource: true }, 'builds'],
        ['configuration', { readonly: false, hasGitSource: false }, 'configuration'],
        ['unknown', { readonly: false, hasGitSource: true }, defaultAgentDrawerTab],
        [null, { readonly: false, hasGitSource: true }, defaultAgentDrawerTab],
        ['builds', { readonly: true, hasGitSource: true }, defaultAgentDrawerTab],
        ['configuration', { readonly: true, hasGitSource: true }, defaultAgentDrawerTab],
        ['builds', { readonly: false, hasGitSource: false }, defaultAgentDrawerTab],
    ] as const)('resolves %s with %o to %s', (requestedTab, options, expected) => {
        expect(AgentDrawerNavigationUtils.resolveTab(requestedTab, options)).toBe(expected);
    });
});
