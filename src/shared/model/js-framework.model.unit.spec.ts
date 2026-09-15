import { jsFrameworkOptions, jsFrameworkPresets } from "./js-framework.model";

describe('jsFrameworkPresets', () => {
    it('provides an install command for every framework preset', () => {
        expect(jsFrameworkOptions.every((preset) => preset.installCommand.trim().length > 0)).toBe(true);
    });

    it('runs build tools through package-manager scripts', () => {
        expect(jsFrameworkOptions.every((preset) => preset.buildCommand === 'npm run build')).toBe(true);
        expect(jsFrameworkPresets.NEXTJS.runCommand).toBe('npm run start');
    });

    it('provides a static-site React preset', () => {
        expect(jsFrameworkPresets.REACT).toMatchObject({
            id: 'REACT',
            installCommand: 'npm install',
            buildCommand: 'npm run build',
            runCommand: '',
            logoSrc: '/framework-logos/react.svg',
            outputDirectory: 'dist',
            defaultPort: 80,
        });
    });
});
