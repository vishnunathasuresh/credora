import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  claimsRoot,
  createSelectiveDisclosure,
  hashCredential,
  hashSelectiveCredential,
  normalizeIssueDate,
  normalizePayload,
  verifySelectiveDisclosure,
  verifySelectiveDisclosureForCredential,
} from './index.js';

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

  it('normalizes issue dates to the hashed second', () => {
    assert.equal(normalizeIssueDate('2026-08-11T00:00:00.999Z'), '2026-08-11T00:00:00.000Z');
  });

  it('supports a versioned credential hash bound to a claims root', () => {
    const root = claimsRoot([
      { name: 'skillName', value: 'Distributed Systems', salt: `0x${'11'.repeat(32)}` },
      { name: 'skillLevel', value: 'Advanced', salt: `0x${'22'.repeat(32)}` },
    ]);
    assert.match(
      hashSelectiveCredential({
        issuerAddress: input.issuerAddress,
        learnerAddress: input.learnerAddress,
        issueDate: input.issueDate,
        metadataUri: input.metadataUri,
        claimsRoot: root,
      }),
      /^0x[0-9a-f]{64}$/,
    );
  });

  it('reveals and verifies only selected claims', () => {
    const claims = [
      { name: 'skillName', value: 'Distributed Systems', salt: `0x${'11'.repeat(32)}` },
      { name: 'skillLevel', value: 'Advanced', salt: `0x${'22'.repeat(32)}` },
      { name: 'issueDate', value: input.issueDate, salt: `0x${'33'.repeat(32)}` },
    ] as const;
    const disclosure = createSelectiveDisclosure({
      credentialHash: hashCredential(input),
      claims: [...claims],
      reveal: ['skillLevel'],
    });
    assert.equal(disclosure.proofs.length, 1);
    assert.equal(disclosure.proofs[0].claim.name, 'skillLevel');
    assert.equal(verifySelectiveDisclosure(disclosure, disclosure.claimsRoot), true);
    const tampered = {
      ...disclosure,
      proofs: [
        {
          ...disclosure.proofs[0],
          claim: { ...disclosure.proofs[0].claim, value: 'Beginner' },
        },
      ],
    };
    assert.equal(verifySelectiveDisclosure(tampered, disclosure.claimsRoot), false);
    assert.equal(verifySelectiveDisclosure(disclosure, `0x${'ff'.repeat(32)}`), false);
    assert.equal(
      verifySelectiveDisclosureForCredential(disclosure, {
        issuerAddress: input.issuerAddress,
        learnerAddress: input.learnerAddress,
        issueDate: input.issueDate,
        metadataUri: input.metadataUri,
      }),
      false,
    );

    const v2Root = claimsRoot([...claims]);
    const v2Hash = hashSelectiveCredential({
      issuerAddress: input.issuerAddress,
      learnerAddress: input.learnerAddress,
      issueDate: input.issueDate,
      metadataUri: input.metadataUri,
      claimsRoot: v2Root,
    });
    const v2Disclosure = createSelectiveDisclosure({
      credentialHash: v2Hash,
      claims: [...claims],
      reveal: ['skillLevel'],
    });
    assert.equal(
      verifySelectiveDisclosureForCredential(v2Disclosure, {
        issuerAddress: input.issuerAddress,
        learnerAddress: input.learnerAddress,
        issueDate: input.issueDate,
        metadataUri: input.metadataUri,
      }),
      true,
    );
  });
});
