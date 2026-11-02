const k3sMocks = vi.hoisted(() => ({
    core: {
        readNamespacedSecret: vi.fn(),
        createNamespacedSecret: vi.fn(),
        replaceNamespacedSecret: vi.fn(),
    },
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: k3sMocks }));

import secretService from './secret.service';
import { Constants } from '@/shared/utils/constants';

describe('secret.service createOrReplaceGenericSecret', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        k3sMocks.core.readNamespacedSecret.mockRejectedValue({ code: 404 });
    });

    it('writes labels and annotations to their respective metadata fields', async () => {
        await secretService.createOrReplaceGenericSecret('sandbox-key', 'project-1', {
            QS_VIRTUAL_KEY: 'virtual-key',
        }, {
            [Constants.QS_ANNOTATION_AGENT_ID]: 'agent-1',
            [Constants.QS_LABEL_AGENT_SANDBOX_VIRTUAL_KEY]: Constants.QS_ANNOTATION_VALUE_TRUE,
        }, {
            [Constants.QS_ANNOTATION_CUSTOM_TAG]: 'feature-branch',
        });

        expect(k3sMocks.core.createNamespacedSecret).toHaveBeenCalledWith({
            namespace: 'project-1',
            body: expect.objectContaining({
                metadata: {
                    name: 'sandbox-key',
                    labels: {
                        [Constants.QS_ANNOTATION_AGENT_ID]: 'agent-1',
                        [Constants.QS_LABEL_AGENT_SANDBOX_VIRTUAL_KEY]: Constants.QS_ANNOTATION_VALUE_TRUE,
                    },
                    annotations: {
                        [Constants.QS_ANNOTATION_CUSTOM_TAG]: 'feature-branch',
                    },
                },
            }),
        });
    });
});
