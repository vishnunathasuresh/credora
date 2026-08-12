import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CredentialMetadata } from '@credora/credential-core';

export interface MetadataStorage {
  put(metadata: CredentialMetadata): Promise<{ uri: string; cid: string }>;
  get(uri: string): Promise<CredentialMetadata>;
}

export class MockStorage implements MetadataStorage {
  private readonly values = new Map<string, CredentialMetadata>();
  private sequence = 0;

  async put(metadata: CredentialMetadata) {
    const cid = `mock-${++this.sequence}`;
    this.values.set(cid, metadata);
    return { cid, uri: `ipfs://${cid}` };
  }

  async get(uri: string) {
    const cid = uri.replace(/^ipfs:\/\//, '');
    const metadata = this.values.get(cid);
    if (!metadata) throw new Error('metadata not found');
    return metadata;
  }
}

export class LocalStorage extends MockStorage {}

export class FileStorage implements MetadataStorage {
  constructor(private readonly rootDir = './.data/metadata') {
    mkdirSync(rootDir, { recursive: true });
  }

  async put(metadata: CredentialMetadata) {
    const serialized = JSON.stringify(metadata);
    const cid = `sha256-${createHash('sha256').update(serialized).digest('hex')}`;
    writeFileSync(join(this.rootDir, `${cid}.json`), serialized, 'utf8');
    return { cid, uri: `local://${cid}` };
  }

  async get(uri: string) {
    const cid = uri.replace(/^local:\/\//, '');
    if (!/^sha256-[a-f0-9]{64}$/.test(cid)) throw new Error('invalid local metadata URI');
    return JSON.parse(
      readFileSync(join(this.rootDir, `${cid}.json`), 'utf8'),
    ) as CredentialMetadata;
  }
}

export type IpfsStorageOptions = {
  gatewayBaseUrl: string;
  uploadUrl: string;
  uploadAuthToken?: string;
  gatewayAuthToken?: string;
  fetchImpl?: typeof fetch;
};

export class IpfsStorage implements MetadataStorage {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: IpfsStorageOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async put(metadata: CredentialMetadata) {
    const response = await this.fetchImpl(this.options.uploadUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.options.uploadAuthToken
          ? { authorization: `Bearer ${this.options.uploadAuthToken}` }
          : {}),
      },
      body: JSON.stringify(metadata),
    });
    if (!response.ok) throw new Error(`IPFS upload failed with ${response.status}`);
    const body = (await response.json()) as { cid?: string; Hash?: string };
    const cid = body.cid ?? body.Hash;
    if (!cid) throw new Error('IPFS upload did not return a CID');
    return { cid, uri: `ipfs://${cid}` };
  }

  async get(uri: string) {
    const cid = uri.replace(/^ipfs:\/\//, '');
    const response = await this.fetchImpl(
      `${this.options.gatewayBaseUrl.replace(/\/$/, '')}/${cid}`,
      {
        headers: this.options.gatewayAuthToken
          ? { authorization: `Bearer ${this.options.gatewayAuthToken}` }
          : undefined,
      },
    );
    if (!response.ok) throw new Error(`IPFS retrieval failed with ${response.status}`);
    return (await response.json()) as CredentialMetadata;
  }
}
