import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const rpc = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const registry = process.env.CREDENTIAL_REGISTRY_ADDRESS;
const issuer = privateKeyToAccount(
  process.env.ANVIL_ISSUER_PRIVATE_KEY ??
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
);
if (!process.env.ANVIL_UNAUTHORIZED_PRIVATE_KEY)
  throw new Error('ANVIL_UNAUTHORIZED_PRIVATE_KEY is required for backend route tests');
const unauthorized = privateKeyToAccount(process.env.ANVIL_UNAUTHORIZED_PRIVATE_KEY);
const learner = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const chain = defineChain({
  id: Number(process.env.CHAIN_ID ?? 31337),
  name: 'Credora Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const issueAbi = [
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
];

async function request(path, options = {}, expectedStatus) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json();
  if (expectedStatus !== undefined)
    assert.equal(response.status, expectedStatus, `${path}: ${JSON.stringify(body)}`);
  else assert.ok(response.ok, `${path} ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function authenticate(account) {
  const challenge = await request('/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ address: account.address }),
  });
  const signature = await account.signMessage({ message: challenge.message });
  const auth = await request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ address: account.address, signature }),
  });
  return { authorization: `Bearer ${auth.token}` };
}

async function issueDraft(headers, label) {
  const draft = await request('/issuances', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      learnerAddress: learner,
      skillName: label,
      skillLevel: 'Advanced',
      issueDate: new Date().toISOString(),
    }),
  });
  const metadata = await request(`/issuances/${draft.id}/metadata`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ description: `Route coverage: ${label}` }),
  });
  return { draft, metadata };
}

await request('/credentials/not-a-hash/verify', {}, 400);
await request(
  '/auth/challenge',
  {
    method: 'POST',
    body: JSON.stringify({ address: 'not-an-address' }),
  },
  400,
);
await request(
  '/issuances',
  {
    method: 'POST',
    body: JSON.stringify({ learnerAddress: learner }),
  },
  401,
);

if (!registry) throw new Error('CREDENTIAL_REGISTRY_ADDRESS is required for backend route tests');
const replayChallenge = await request('/auth/challenge', {
  method: 'POST',
  body: JSON.stringify({ address: issuer.address }),
});
const replaySignature = await issuer.signMessage({ message: replayChallenge.message });
await request('/auth/verify', {
  method: 'POST',
  body: JSON.stringify({ address: issuer.address, signature: replaySignature }),
});
await request(
  '/auth/verify',
  {
    method: 'POST',
    body: JSON.stringify({ address: issuer.address, signature: replaySignature }),
  },
  401,
);
const issuerHeaders = await authenticate(issuer);
const unauthorizedHeaders = await authenticate(unauthorized);
await request(
  '/issuances',
  {
    method: 'POST',
    headers: unauthorizedHeaders,
    body: JSON.stringify({
      learnerAddress: learner,
      skillName: 'Unauthorized issuer',
      skillLevel: 'Basic',
      issueDate: new Date().toISOString(),
    }),
  },
  403,
);

const wallet = createWalletClient({ account: issuer, chain, transport: http(rpc) });
const unauthorizedWallet = createWalletClient({
  account: unauthorized,
  chain,
  transport: http(rpc),
});
const publicClient = createPublicClient({ chain, transport: http(rpc) });
const happy = await issueDraft(issuerHeaders, 'Route happy path');
const transactionHash = await wallet.writeContract({
  address: registry,
  abi: issueAbi,
  functionName: 'issueCredential',
  args: [happy.metadata.credentialHash, learner, happy.metadata.uri],
});
await request(`/issuances/${happy.draft.id}/confirm`, {
  method: 'POST',
  headers: issuerHeaders,
  body: JSON.stringify({ transactionHash, credentialHash: happy.metadata.credentialHash }),
});
await request(
  `/issuances/${happy.draft.id}/confirm`,
  {
    method: 'POST',
    headers: issuerHeaders,
    body: JSON.stringify({ transactionHash, credentialHash: happy.metadata.credentialHash }),
  },
  409,
);

const storageRoot = resolve(process.cwd(), process.env.API_STORAGE_PATH ?? './.data/metadata');
const tamperedPath = resolve(storageRoot, `${happy.metadata.cid}.json`);
const { readFile, writeFile } = await import('node:fs/promises');
const tampered = JSON.parse(await readFile(tamperedPath, 'utf8'));
tampered.skillLevel = 'Tampered';
await writeFile(tamperedPath, JSON.stringify(tampered));
const invalid = await request(`/credentials/${happy.metadata.credentialHash}/verify`);
assert.equal(invalid.state, 'metadata-invalid');

const missingHash = keccak256(toBytes(`missing-${Date.now()}`));
const missingTransaction = await wallet.writeContract({
  address: registry,
  abi: issueAbi,
  functionName: 'issueCredential',
  args: [
    missingHash,
    learner,
    'local://sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ],
});
await publicClient.waitForTransactionReceipt({ hash: missingTransaction });
const unavailable = await request(`/credentials/${missingHash}/verify`, {}, 503);
assert.equal(unavailable.state, 'metadata-unavailable');

const reverted = await issueDraft(issuerHeaders, 'Route reverted transaction');
const revertedHash = await unauthorizedWallet.writeContract({
  address: registry,
  abi: issueAbi,
  functionName: 'issueCredential',
  args: [reverted.metadata.credentialHash, learner, reverted.metadata.uri],
});
const revertedResult = await request(
  `/issuances/${reverted.draft.id}/confirm`,
  {
    method: 'POST',
    headers: issuerHeaders,
    body: JSON.stringify({
      transactionHash: revertedHash,
      credentialHash: reverted.metadata.credentialHash,
    }),
  },
  409,
);
assert.equal(revertedResult.state, 'transaction-reverted');

console.log(JSON.stringify({ ok: true, cases: 9 }, null, 2));
