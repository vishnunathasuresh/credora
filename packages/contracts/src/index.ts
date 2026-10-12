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
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setIssuerAuthorization',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'issuer', type: 'address' },
      { name: 'authorized', type: 'bool' },
    ],
    outputs: [],
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

/** ABI for organization-bound credential protocol v3. Keep v1 registry ABI stable. */
export const organizationCredentialRegistryAbi = [
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'activateOrganization',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'organizationId', type: 'bytes32' },
      { name: 'initialAdmin', type: 'address' },
      { name: 'metadataUri', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setOrganizationAdmin',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'organizationId', type: 'bytes32' },
      { name: 'account', type: 'address' },
      { name: 'authorized', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setIssuerAuthorization',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'organizationId', type: 'bytes32' },
      { name: 'issuer', type: 'address' },
      { name: 'authorized', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setOrganizationSuspended',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'organizationId', type: 'bytes32' },
      { name: 'suspended', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'updateOrganizationMetadata',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'organizationId', type: 'bytes32' },
      { name: 'metadataUri', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isOrganizationAdmin',
    stateMutability: 'view',
    inputs: [
      { name: 'organizationId', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isAuthorizedIssuer',
    stateMutability: 'view',
    inputs: [
      { name: 'organizationId', type: 'bytes32' },
      { name: 'issuer', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getOrganization',
    stateMutability: 'view',
    inputs: [{ name: 'organizationId', type: 'bytes32' }],
    outputs: [
      { name: 'initialAdmin', type: 'address' },
      { name: 'metadataUri', type: 'string' },
      { name: 'activatedAt', type: 'uint64' },
      { name: 'exists', type: 'bool' },
      { name: 'suspended', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'issueCredential',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'organizationId', type: 'bytes32' },
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
      { name: 'organizationId', type: 'bytes32' },
      { name: 'issuer', type: 'address' },
      { name: 'learner', type: 'address' },
      { name: 'metadataUri', type: 'string' },
      { name: 'issuedAt', type: 'uint64' },
      { name: 'exists', type: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'OrganizationActivated',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'organizationId', type: 'bytes32' },
      { indexed: true, name: 'initialAdmin', type: 'address' },
      { indexed: false, name: 'metadataUri', type: 'string' },
      { indexed: false, name: 'activatedAt', type: 'uint64' },
    ],
  },
  {
    type: 'event',
    name: 'OrganizationAdminChanged',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'organizationId', type: 'bytes32' },
      { indexed: true, name: 'account', type: 'address' },
      { indexed: false, name: 'authorized', type: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'OrganizationIssuerAuthorizationChanged',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'organizationId', type: 'bytes32' },
      { indexed: true, name: 'issuer', type: 'address' },
      { indexed: false, name: 'authorized', type: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'OrganizationMetadataUpdated',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'organizationId', type: 'bytes32' },
      { indexed: false, name: 'metadataUri', type: 'string' },
    ],
  },
  {
    type: 'event',
    name: 'OrganizationSuspensionChanged',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'organizationId', type: 'bytes32' },
      { indexed: false, name: 'suspended', type: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'OrganizationCredentialIssued',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'credentialHash', type: 'bytes32' },
      { indexed: true, name: 'organizationId', type: 'bytes32' },
      { indexed: true, name: 'issuer', type: 'address' },
      { indexed: false, name: 'learner', type: 'address' },
      { indexed: false, name: 'metadataUri', type: 'string' },
      { indexed: false, name: 'issuedAt', type: 'uint64' },
    ],
  },
] as const;

export type OrganizationCredentialRegistryAbi = typeof organizationCredentialRegistryAbi;
