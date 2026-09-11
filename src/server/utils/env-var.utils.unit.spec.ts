import { EnvVarUtils } from "./env-var.utils";
import { AppExtendedModel } from "@/shared/model/app-extended.model";

function appWithEnvVars(envVars: string, buildArgs: string): AppExtendedModel {
    return { envVars, buildArgs } as AppExtendedModel;
}

describe('EnvVarUtils', () => {
    describe('parseEnvVariables', () => {
        it('parses newline separated KEY=VALUE pairs', () => {
            const app = appWithEnvVars('FOO=bar\nBAZ=qux', '');

            expect(EnvVarUtils.parseEnvVariables(app)).toEqual([
                { name: 'FOO', value: 'bar' },
                { name: 'BAZ', value: 'qux' },
            ]);
        });

        it('ignores empty lines', () => {
            const app = appWithEnvVars('FOO=bar\n\nBAZ=qux\n', '');

            expect(EnvVarUtils.parseEnvVariables(app)).toEqual([
                { name: 'FOO', value: 'bar' },
                { name: 'BAZ', value: 'qux' },
            ]);
        });

        it('returns an empty list when no env variables are set', () => {
            expect(EnvVarUtils.parseEnvVariables(appWithEnvVars('', ''))).toEqual([]);
        });
    });

    describe('parseBuildArgs', () => {
        it('parses newline separated KEY=VALUE build arguments', () => {
            const app = appWithEnvVars('', 'FOO=bar\nBAZ=qux');

            expect(EnvVarUtils.parseBuildArgs(app)).toEqual([
                { name: 'FOO', value: 'bar' },
                { name: 'BAZ', value: 'qux' },
            ]);
        });

        it('splits on the first equals sign so values may contain equals signs', () => {
            const app = appWithEnvVars('', 'TOKEN=a=b=c');

            expect(EnvVarUtils.parseBuildArgs(app)).toEqual([
                { name: 'TOKEN', value: 'a=b=c' },
            ]);
        });

        it('treats a line without an equals sign as an empty value', () => {
            const app = appWithEnvVars('', 'STANDALONE');

            expect(EnvVarUtils.parseBuildArgs(app)).toEqual([
                { name: 'STANDALONE', value: '' },
            ]);
        });

        it('ignores empty lines', () => {
            const app = appWithEnvVars('', 'FOO=bar\n\nBAZ=qux\n');

            expect(EnvVarUtils.parseBuildArgs(app)).toEqual([
                { name: 'FOO', value: 'bar' },
                { name: 'BAZ', value: 'qux' },
            ]);
        });

        it('returns an empty list when no build arguments are set', () => {
            expect(EnvVarUtils.parseBuildArgs(appWithEnvVars('', ''))).toEqual([]);
        });
    });
});
