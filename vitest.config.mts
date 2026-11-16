import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // jsdom has no page origin for relative URLs, so tests call the API through an absolute base.
    // NEXT_PUBLIC_CLIENT_APP keeps the per-app screens on localhost; the single sign-in tests switch it off with vi.stubEnv.
    env: { NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1', NEXT_PUBLIC_CLIENT_APP: 'ADMIN' },
  },
});
