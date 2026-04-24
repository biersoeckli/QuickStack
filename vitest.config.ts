import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
          exclude: ['src/__tests__/integration/**/*.spec.ts', 'src/__tests__/integration/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node-integration',
          environment: 'node',
          include: ['src/__tests__/integration/**/*.spec.ts', 'src/__tests__/integration/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
    },
  },
})
