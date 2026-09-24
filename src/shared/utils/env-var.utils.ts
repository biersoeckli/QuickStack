import type { AppExtendedModel } from '@/shared/model/app-extended.model';

type EnvVarSource = Pick<AppExtendedModel, 'envVars' | 'buildArgs'>;

export class EnvVarUtils {
    static parseEnvVariables(app: EnvVarSource) {
        return app.envVars
            ? app.envVars
                .split('\n')
                .filter((value) => !!value)
                .map((env) => {
                    const [name] = env.split('=');
                    const value = env.replace(`${name}=`, '');
                    return { name, value };
                })
            : [];
    }

    static parseBuildArgs(app: EnvVarSource) {
        return app.buildArgs
            ? app.buildArgs
                .split('\n')
                .filter((value) => !!value)
                .map((buildArg) => {
                    const separatorIndex = buildArg.indexOf('=');
                    if (separatorIndex === -1) {
                        return { name: buildArg, value: '' };
                    }
                    return {
                        name: buildArg.slice(0, separatorIndex),
                        value: buildArg.slice(separatorIndex + 1),
                    };
                })
            : [];
    }
}
