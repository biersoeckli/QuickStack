import { AppExtendedModel } from '../model/app-extended.model';

type RuleType = 'INGRESS' | 'EGRESS';

/** Configures the explicit policy required for one template app to reach another. */
export class NetworkPolicyTemplateUtils {
    static allowAppConnection(source: AppExtendedModel, target: AppExtendedModel, port: number) {
        this.addRule(source, 'EGRESS', target, port);
        this.addRule(target, 'INGRESS', source, port);
    }

    private static addRule(app: AppExtendedModel, type: RuleType, target: AppExtendedModel, port: number) {
        const policy = app.appNetworkPolicy ?? {
            appId: app.id,
            allowInternetAccess: true,
            rules: [],
        } as unknown as NonNullable<AppExtendedModel['appNetworkPolicy']>;

        policy.rules.push({
            type,
            targetAppId: target.id,
            targetAgentId: null,
            port,
            protocol: 'TCP',
            targetApp: { id: target.id, name: target.name, projectId: target.projectId },
            targetAgent: null,
        } as NonNullable<AppExtendedModel['appNetworkPolicy']>['rules'][number]);
        app.appNetworkPolicy = policy;
    }
}
