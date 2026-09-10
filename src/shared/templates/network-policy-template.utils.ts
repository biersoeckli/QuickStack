import { AppExtendedModel, AppExtendedWriteModel } from '../model/app-extended.model';

type RuleType = 'INGRESS' | 'EGRESS';

/** Configures the explicit policy required for one template app to reach another. */
export class NetworkPolicyTemplateUtils {
    static allowAppConnection(source: AppExtendedModel, target: AppExtendedModel, port: number) {
        this.addRule(source, 'EGRESS', target, port);
        this.addRule(target, 'INGRESS', source, port);
    }

    private static addRule(app: AppExtendedModel, type: RuleType, target: AppExtendedModel, port: number) {
        const existingRules = app.appNetworkPolicy?.rules ?? [];
        const allowInternetAccess = app.appNetworkPolicy?.allowInternetAccess ?? true;

        const configuration: NonNullable<AppExtendedWriteModel['appNetworkPolicy']> = {
            allowInternetAccess,
            rules: [
                ...existingRules,
                { type, targetAppId: target.id, targetAgentId: null, port, protocol: 'TCP' },
            ],
        };

        // The read model carries server-assigned rule metadata; persist assigns it.
        app.appNetworkPolicy = configuration as unknown as AppExtendedModel['appNetworkPolicy'];
    }
}
