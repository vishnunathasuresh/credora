// NEXT_PUBLIC_* remains readable for existing deployment configuration.
export const publicEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  apiUrl:
    import.meta.env.VITE_API_URL ?? import.meta.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000',
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? import.meta.env.NEXT_PUBLIC_CHAIN_ID ?? 31337),
  rpcUrl:
    import.meta.env.VITE_RPC_URL ?? import.meta.env.NEXT_PUBLIC_RPC_URL ?? 'http://127.0.0.1:8545',
  credentialRegistryAddress:
    import.meta.env.VITE_CREDENTIAL_REGISTRY_ADDRESS ??
    import.meta.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS,
  organizationCredentialRegistryAddress:
    import.meta.env.VITE_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS ??
    import.meta.env.NEXT_PUBLIC_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS,
  ipfsGatewayUrl:
    import.meta.env.VITE_IPFS_GATEWAY_URL ?? import.meta.env.NEXT_PUBLIC_IPFS_GATEWAY_URL,
};
