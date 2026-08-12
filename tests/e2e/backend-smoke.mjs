import { createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const rpc = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const registry = process.env.CREDENTIAL_REGISTRY_ADDRESS;
if (!registry) throw new Error('CREDENTIAL_REGISTRY_ADDRESS is required');

const chain = defineChain({
  id: Number(process.env.CHAIN_ID ?? 31337),
  name: 'Credora Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const issuer = privateKeyToAccount(
  process.env.ANVIL_ISSUER_PRIVATE_KEY ??
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
);
const learner = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const wallet = createWalletClient({ account: issuer, chain, transport: http(rpc) });

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const challenge = await request('/auth/challenge', {
  method: 'POST',
  body: JSON.stringify({ address: issuer.address }),
});
const signature = await issuer.signMessage({ message: challenge.message });
const auth = await request('/auth/verify', {
  method: 'POST',
  body: JSON.stringify({ address: issuer.address, signature }),
});
const headers = { authorization: `Bearer ${auth.token}` };
const draft = await request('/issuances', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    learnerAddress: learner,
    skillName: 'Local Anvil Integration',
    skillLevel: 'Advanced',
    issueDate: new Date().toISOString(),
  }),
});
const metadata = await request(`/issuances/${draft.id}/metadata`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ description: 'End-to-end local registry proof' }),
});
const credentialHash = metadata.credentialHash;
const transactionHash = await wallet.writeContract({
  address: registry,
  abi: [
    {
      type: 'function',
      name: 'issueCredential',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'credentialHash', type: 'bytes32' },
        { name: 'learner', type: 'address' },
        { name: 'metadataUri', type: 'string' },
      ],
      outputs: [],
    },
  ],
  functionName: 'issueCredential',
  args: [credentialHash, learner, metadata.uri],
});
const confirmed = await request(`/issuances/${draft.id}/confirm`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ transactionHash, credentialHash }),
});
const verified = await request(`/credentials/${credentialHash}/verify`);
if (verified.state !== 'valid') throw new Error(`Expected valid verification: ${verified.state}`);
console.log(
  JSON.stringify(
    {
      issuanceId: draft.id,
      transactionHash,
      confirmedState: confirmed.state,
      verificationState: verified.state,
    },
    null,
    2,
  ),
);
