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
    plugins: [tailwindcss(), tanstackStart(), react()],
  };
});
