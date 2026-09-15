import { z } from "zod";

export const jsFrameworkZodModel = z.enum(["NEXTJS", "ANGULAR", "NUXT", "ASTRO", "SVELTEKIT"]);
export type JsFramework = z.infer<typeof jsFrameworkZodModel>;

export type JsFrameworkPreset = {
    id: JsFramework;
    label: string;
    description: string;
    installCommand: string;
    buildCommand: string;
    runCommand: string;
    rootDirectory: string;
    outputDirectory: string;
    defaultPort: number;
};

/**
 * Pre-filled build settings for the most used JavaScript frameworks.
 * Values mirror Vercel framework presets, except where Vercel still ships stale output directories.
 */
export const jsFrameworkPresets: Record<JsFramework, JsFrameworkPreset> = {
    NEXTJS: {
        id: 'NEXTJS',
        label: 'Next.js',
        description: 'React framework with SSR, SSG and API routes.',
        installCommand: '',
        buildCommand: 'next build',
        runCommand: 'next start',
        rootDirectory: './',
        outputDirectory: '.next',
        defaultPort: 3000,
    },
    ANGULAR: {
        id: 'ANGULAR',
        label: 'Angular',
        description: 'TypeScript SPA framework, served as static files.',
        installCommand: '',
        buildCommand: 'ng build',
        runCommand: '',
        rootDirectory: './',
        outputDirectory: 'dist',
        defaultPort: 80,
    },
    NUXT: {
        id: 'NUXT',
        label: 'Nuxt',
        description: 'Vue framework with a Nitro Node server.',
        installCommand: '',
        buildCommand: 'nuxt build',
        runCommand: 'node .output/server/index.mjs',
        rootDirectory: './',
        outputDirectory: '.output',
        defaultPort: 3000,
    },
    ASTRO: {
        id: 'ASTRO',
        label: 'Astro',
        description: 'Content-focused framework, built as a static site.',
        installCommand: '',
        buildCommand: 'astro build',
        runCommand: '',
        rootDirectory: './',
        outputDirectory: 'dist',
        defaultPort: 80,
    },
    SVELTEKIT: {
        id: 'SVELTEKIT',
        label: 'SvelteKit',
        description: 'Svelte framework with an adapter-node server.',
        installCommand: '',
        buildCommand: 'vite build',
        runCommand: 'node build',
        rootDirectory: './',
        outputDirectory: 'build',
        defaultPort: 3000,
    },
};

export const jsFrameworkOptions = Object.values(jsFrameworkPresets);
