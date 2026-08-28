import assert from 'node:assert/strict';
import { IpfsStorage } from '../../packages/storage/src/index.ts';

const uploadUrl = process.env.IPFS_UPLOAD_URL;
const gatewayBaseUrl = process.env.IPFS_GATEWAY_URL;
if (!uploadUrl || !gatewayBaseUrl)
  throw new Error(
    'IPFS_UPLOAD_URL and IPFS_GATEWAY_URL are required for the IPFS integration test',
  );

const storage = new IpfsStorage({
  uploadUrl,
  gatewayBaseUrl,
  uploadAuthToken: process.env.IPFS_UPLOAD_AUTH_TOKEN,
  gatewayAuthToken: process.env.IPFS_GATEWAY_AUTH_TOKEN,
});
const metadata = {
  schemaVersion: 1,
  skillName: 'Credora IPFS integration',
  skillLevel: 'Advanced',
  issueDate: '2026-08-12T00:00:00.000Z',
  issuerAddress: '0x0000000000000000000000000000000000000001',
  learnerAddress: '0x0000000000000000000000000000000000000002',
  description: `integration-${Date.now()}`,
};
const stored = await storage.put(metadata);
assert.ok(stored.cid);
assert.equal(stored.uri, `ipfs://${stored.cid}`);
const fetched = await storage.get(stored.uri);
assert.deepEqual(fetched, metadata);
console.log(JSON.stringify({ ok: true, cid: stored.cid }, null, 2));
