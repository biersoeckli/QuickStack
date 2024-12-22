import { AppExtendedModel } from "@/shared/model/app-extended.model";

export class EnvVarUtils {
    static parseEnvVariables(app: AppExtendedModel) {
        return app.envVars ? app.envVars.split('\n').filter(x => !!x).map(env => {
            const [name] = env.split('=');
            const value = env.replace(`${name}=`, '');
            return { name, value };
        }) : [];
    }
}