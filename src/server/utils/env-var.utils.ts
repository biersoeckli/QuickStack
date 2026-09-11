import { AppExtendedModel } from "@/shared/model/app-extended.model";

export class EnvVarUtils {
    static parseEnvVariables(app: AppExtendedModel) {
        return app.envVars ? app.envVars.split('\n').filter(x => !!x).map(env => {
            const [name] = env.split('=');
            const value = env.replace(`${name}=`, '');
            return { name, value };
        }) : [];
    }

    static parseBuildArgs(app: AppExtendedModel) {
        return app.buildArgs ? app.buildArgs.split('\n').filter(x => !!x).map(buildArg => {
            const separatorIndex = buildArg.indexOf('=');
            if (separatorIndex === -1) {
                return { name: buildArg, value: '' };
            }
            return { name: buildArg.slice(0, separatorIndex), value: buildArg.slice(separatorIndex + 1) };
        }) : [];
    }
}