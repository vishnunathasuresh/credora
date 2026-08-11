export const credentialRegistryAbi = [
  {
    type: 'function',
    name: 'ISSUER_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'isAuthorizedIssuer',
    stateMutability: 'view',
    inputs: [{ name: 'issuer', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
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
  {
    type: 'function',
    name: 'getCredential',
    stateMutability: 'view',
    inputs: [{ name: 'credentialHash', type: 'bytes32' }],
    outputs: [
      { name: 'issuer', type: 'address' },
      { name: 'learner', type: 'address' },
      { name: 'metadataUri', type: 'string' },
      { name: 'issuedAt', type: 'uint64' },
      { name: 'exists', type: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'CredentialIssued',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'credentialHash', type: 'bytes32' },
      { indexed: true, name: 'issuer', type: 'address' },
      { indexed: true, name: 'learner', type: 'address' },
      { indexed: false, name: 'metadataUri', type: 'string' },
      { indexed: false, name: 'issuedAt', type: 'uint64' },
    ],
  },
  {
    type: 'event',
    name: 'IssuerAuthorizationChanged',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'issuer', type: 'address' },
      { indexed: false, name: 'authorized', type: 'bool' },
    ],
  },
] as const;

export type CredentialRegistryAbi = typeof credentialRegistryAbi;
