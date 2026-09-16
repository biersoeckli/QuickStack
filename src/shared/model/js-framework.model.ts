import { z } from "zod";

export const jsFrameworkZodModel = z.enum(["NEXTJS", "REACT", "ANGULAR", "NUXT", "ASTRO", "SVELTEKIT"]);
export type JsFramework = z.infer<typeof jsFrameworkZodModel>;

export type JsFrameworkPreset = {
    id: JsFramework;
    label: string;
    description: string;
    logoSrc: string;
    installCommand: string;
    buildCommand: string;
    runCommand: string;
    rootDirectory: string;
    outputDirectory: string;
    defaultPort: number;
};

/**
 * Pre-filled build settings for the most used JavaScript frameworks.
 */
export const jsFrameworkPresets: Record<JsFramework, JsFrameworkPreset> = {
    NEXTJS: {
        id: 'NEXTJS',
        label: 'Next.js',
        description: 'React framework with SSR, SSG and API routes.',
        logoSrc: '/framework-logos/nextjs.svg',
        installCommand: 'npm install --force',
        buildCommand: 'npm run build',
        runCommand: 'npm run start',
        rootDirectory: './',
        outputDirectory: '.next',
        defaultPort: 3000,
    },
    REACT: {
        id: 'REACT',
        label: 'React',
        description: 'React single-page application, served as static files.',
        logoSrc: '/framework-logos/react.svg',
        installCommand: 'npm install --force',
        buildCommand: 'npm run build',
        runCommand: '',
        rootDirectory: './',
        outputDirectory: 'dist',
        defaultPort: 80,
    },
    ANGULAR: {
        id: 'ANGULAR',
        label: 'Angular',
        description: 'TypeScript SPA framework, served as static files.',
        logoSrc: '/framework-logos/angular.png',
        installCommand: 'npm install --force',
        buildCommand: 'npm run build',
        runCommand: '',
        rootDirectory: './',
        outputDirectory: 'dist',
        defaultPort: 80,
    },
    NUXT: {
        id: 'NUXT',
        label: 'Nuxt',
        description: 'Vue framework with a Nitro Node server.',
        logoSrc: '/framework-logos/nuxt.svg',
        installCommand: 'npm install --force',
        buildCommand: 'npm run build',
        runCommand: 'node .output/server/index.mjs',
        rootDirectory: './',
        outputDirectory: '.output',
        defaultPort: 3000,
    },
    ASTRO: {
        id: 'ASTRO',
        label: 'Astro',
        description: 'Content-focused framework, built as a static site.',
        logoSrc: '/framework-logos/astro.svg',
        installCommand: 'npm install --force',
        buildCommand: 'npm run build',
        runCommand: '',
        rootDirectory: './',
        outputDirectory: 'dist',
        defaultPort: 80,
    },
    SVELTEKIT: {
        id: 'SVELTEKIT',
        label: 'SvelteKit',
        description: 'Svelte framework with an adapter-node server.',
        logoSrc: '/framework-logos/sveltekit.png',
        installCommand: 'npm install --force',
        buildCommand: 'npm run build',
        runCommand: 'node build',
        rootDirectory: './',
        outputDirectory: 'build',
        defaultPort: 3000,
    },
};

export const jsFrameworkOptions = Object.values(jsFrameworkPresets);
