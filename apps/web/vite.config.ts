import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const legacyBrowserVariables = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_CHAIN_ID',
  'NEXT_PUBLIC_RPC_URL',
  'NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS',
  'NEXT_PUBLIC_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS',
  'NEXT_PUBLIC_IPFS_GATEWAY_URL',
] as const;

const legacyShareFragmentRedirect = {
  name: 'credora-legacy-share-fragment-redirect',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      const match = pathname.match(/^\/share\/([A-Za-z0-9_-]{43})\/?$/);
      if (match && request.method === 'GET') {
        response.statusCode = 303;
        response.setHeader('location', `/share#${match[1]}`);
        response.setHeader('cache-control', 'no-store');
        response.setHeader('referrer-policy', 'no-referrer');
        response.end();
        return;
      }
      next();
    });
  },
};

export default defineConfig(({ mode }) => {
  const legacy = loadEnv(mode, process.cwd(), 'NEXT_PUBLIC_');
  return {
    envPrefix: 'VITE_',
    define: Object.fromEntries(
      legacyBrowserVariables.flatMap((name) =>
        legacy[name] === undefined
          ? []
          : [[`import.meta.env.${name}`, JSON.stringify(legacy[name])]],
      ),
    ),
    resolve: { tsconfigPaths: true },
    plugins: [legacyShareFragmentRedirect, tailwindcss(), tanstackStart(), react()],
  };
});
