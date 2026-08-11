import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashCredential, normalizePayload } from './index.js';

const input = {
  issuerAddress: '0x1111111111111111111111111111111111111111',
  learnerAddress: '0x2222222222222222222222222222222222222222',
  skillName: 'Distributed Systems',
  skillLevel: 'Advanced',
  issueDate: '2026-08-11T00:00:00.000Z',
  metadataUri: 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
} as const;

describe('credential-core', () => {
  it('normalizes addresses and dates deterministically', () => {
    const payload = normalizePayload(input);
    assert.equal(payload.issuerAddress, input.issuerAddress);
    assert.equal(payload.issueDate, input.issueDate);
  });

  it('produces the same hash for equivalent text normalization', () => {
    assert.equal(
      hashCredential(input),
      hashCredential({ ...input, skillName: ' Distributed Systems ' }),
    );
  });

  it('changes the proof when metadata changes', () => {
    assert.notEqual(
      hashCredential(input),
      hashCredential({ ...input, metadataUri: 'ipfs://different' }),
    );
  });
});
