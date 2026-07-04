import { AgentModelAliasUtils } from './agent-model-alias.utils';

describe('AgentModelAliasUtils', () => {
    it('normalizes arrays of aliases', () => {
        expect(AgentModelAliasUtils.normalize(['gpt-4o', 'deepseek-v4-pro'])).toEqual(['gpt-4o', 'deepseek-v4-pro']);
    });

    it('normalizes JSON encoded arrays', () => {
        expect(AgentModelAliasUtils.normalize('["gpt-4o","deepseek-v4-pro"]')).toEqual(['gpt-4o', 'deepseek-v4-pro']);
    });

    it('normalizes arrays containing JSON encoded arrays', () => {
        expect(AgentModelAliasUtils.normalize(['["gpt-4o","deepseek-v4-pro"]'])).toEqual(['gpt-4o', 'deepseek-v4-pro']);
    });

    it('keeps legacy single aliases compatible', () => {
        expect(AgentModelAliasUtils.normalize('gpt-4o')).toEqual(['gpt-4o']);
    });

    it('drops empty and non-string values', () => {
        expect(AgentModelAliasUtils.normalize(['gpt-4o', '', null, 1])).toEqual(['gpt-4o']);
    });
});
