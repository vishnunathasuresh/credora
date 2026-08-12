import {
  createPublicClient,
  decodeFunctionData,
  http,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { credentialRegistryAbi } from '@credora/contracts';
import type { VerificationState } from '@credora/shared';

export type BlockchainConfig = {
  chain: Chain;
  rpcUrl: string;
  contractAddress: Address;
};

export type IssueCredentialInput = {
  credentialHash: Hex;
  learner: Address;
  metadataUri: string;
};

export type CredentialReference = Hex;

export type CredentialLookupResult = {
  state: Extract<VerificationState, 'valid' | 'not-found'>;
  credentialHash: Hex;
  issuer?: Address;
  learner?: Address;
  metadataUri?: string;
  issuedAt?: bigint;
};

export type PendingTransaction = { hash: Hex };
export type ConfirmedTransaction = {
  hash: Hex;
  blockNumber: bigint;
  status: 'success' | 'reverted';
};

export type IssuanceTransaction = {
  from: Address;
  credentialHash: Hex;
  learner: Address;
  metadataUri: string;
};

export interface BlockchainAdapter {
  isIssuerAuthorized(address: Address): Promise<boolean>;
  issueCredential(input: IssueCredentialInput): Promise<PendingTransaction>;
  getCredential(ref: CredentialReference): Promise<CredentialLookupResult>;
  getIssuanceTransaction(txHash: Hex): Promise<IssuanceTransaction | undefined>;
  waitForConfirmation(txHash: Hex): Promise<ConfirmedTransaction>;
}

export function createCredoraPublicClient(config: BlockchainConfig) {
  return createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
}

export class RegistryBlockchainAdapter implements BlockchainAdapter {
  constructor(
    private readonly config: BlockchainConfig,
    private readonly publicClient: PublicClient<Transport, Chain>,
    private readonly walletClient?: WalletClient<Transport, Chain>,
  ) {}

  async isIssuerAuthorized(address: Address) {
    return this.publicClient.readContract({
      address: this.config.contractAddress,
      abi: credentialRegistryAbi,
      functionName: 'isAuthorizedIssuer',
      args: [address],
    });
  }

  async issueCredential(input: IssueCredentialInput) {
    if (!this.walletClient?.account)
      throw new Error('A connected wallet is required to issue credentials');
    const hash = await this.walletClient.writeContract({
      address: this.config.contractAddress,
      abi: credentialRegistryAbi,
      functionName: 'issueCredential',
      args: [input.credentialHash, input.learner, input.metadataUri],
      account: this.walletClient.account,
      chain: this.config.chain,
    });
    return { hash };
  }

  async getCredential(credentialHash: Hex): Promise<CredentialLookupResult> {
    const [issuer, learner, metadataUri, issuedAt, exists] = await this.publicClient.readContract({
      address: this.config.contractAddress,
      abi: credentialRegistryAbi,
      functionName: 'getCredential',
      args: [credentialHash],
    });
    if (!exists) return { state: 'not-found', credentialHash };
    return { state: 'valid', credentialHash, issuer, learner, metadataUri, issuedAt };
  }

  async getIssuanceTransaction(txHash: Hex): Promise<IssuanceTransaction | undefined> {
    const transaction = await this.publicClient.getTransaction({ hash: txHash });
    if (
      !transaction.to ||
      transaction.to.toLowerCase() !== this.config.contractAddress.toLowerCase()
    )
      return undefined;

    try {
      const decoded = decodeFunctionData({ abi: credentialRegistryAbi, data: transaction.input });
      if (decoded.functionName !== 'issueCredential') return undefined;
      const [credentialHash, learner, metadataUri] = decoded.args;
      return {
        from: transaction.from,
        credentialHash,
        learner,
        metadataUri,
      };
    } catch {
      return undefined;
    }
  }

  async waitForConfirmation(txHash: Hex): Promise<ConfirmedTransaction> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { hash: txHash, blockNumber: receipt.blockNumber, status: receipt.status };
  }
}
