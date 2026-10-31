/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_CREDENTIAL_REGISTRY_ADDRESS?: `0x${string}`;
  readonly VITE_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS?: `0x${string}`;
  readonly VITE_IPFS_GATEWAY_URL?: string;
  readonly NEXT_PUBLIC_API_URL?: string;
  readonly NEXT_PUBLIC_CHAIN_ID?: string;
  readonly NEXT_PUBLIC_RPC_URL?: string;
  readonly NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS?: `0x${string}`;
  readonly NEXT_PUBLIC_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS?: `0x${string}`;
  readonly NEXT_PUBLIC_IPFS_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
