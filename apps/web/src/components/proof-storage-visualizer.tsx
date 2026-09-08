'use client';

import { useState } from 'react';
import { CheckIcon } from './icons';

type ProofStage = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  summary: string;
  detail: string;
  source: string;
  rows: Array<{ label: string; value: string; code?: boolean }>;
};

const stages: ProofStage[] = [
  {
    id: 'prepare',
    number: '01',
    eyebrow: 'Prepare',
    title: 'The credential becomes canonical.',
    summary: 'Claims are normalized before any record is written.',
    detail:
      'The issuer and learner addresses, skill, level, issue date, metadata URI, and protocol version make up the v1 payload. Private keys and unnecessary learner details stay out of the public proof.',
    source: 'Canonical payload',
    rows: [
      { label: 'Protocol', value: 'v1' },
      { label: 'Bound fields', value: 'issuer · learner · skill · level · date · URI' },
      { label: 'Privacy boundary', value: 'Commitment, not a public learner profile' },
    ],
  },
  {
    id: 'hash',
    number: '02',
    eyebrow: 'Generate',
    title: 'A Keccak-256 hash binds the proof.',
    summary: 'The hash is the credential reference, not the storage address.',
    detail:
      'The canonical payload is hashed with versioned Keccak-256. The resulting 32-byte value binds the credential fields together so a verifier can detect any change later.',
    source: 'Proof generated',
    rows: [
      { label: 'Hash function', value: 'Keccak-256' },
      { label: 'Credential hash', value: '0x8f…91ac', code: true },
      { label: 'Separate from', value: 'IPFS CID / metadata address' },
    ],
  },
  {
    id: 'anchor',
    number: '03',
    eyebrow: 'Anchor',
    title: 'The registry keeps the immutable record.',
    summary: 'The chain stores proof bindings; IPFS stores public metadata bytes.',
    detail:
      'CredentialRegistry stores the credential hash, issuer, learner, metadata URI, issuance time, and existence. The metadata URI can point to an IPFS CID, but the CID is never treated as the credential hash.',
    source: 'Authoritative record',
    rows: [
      { label: 'Registry', value: 'CredentialRegistry' },
      { label: 'Lookup', value: 'getCredential(bytes32)', code: true },
      { label: 'Metadata URI', value: 'ipfs://bafy…8p4m', code: true },
    ],
  },
  {
    id: 'verify',
    number: '04',
    eyebrow: 'Verify',
    title: 'Anyone can check the same proof.',
    summary: 'A verifier reads the chain, fetches metadata, and recomputes the hash.',
    detail:
      'Independent verification compares the registry record with the metadata manifest and a fresh hash. A gateway outage, missing record, malformed metadata, or mismatch stays distinct from a valid proof.',
    source: 'Independent verification',
    rows: [
      { label: 'Read first', value: 'Blockchain registry' },
      { label: 'Fetch next', value: 'Public metadata gateway' },
      { label: 'Wallet needed', value: 'No — read-only verification' },
    ],
  },
];

export function ProofStorageVisualizer() {
  const [activeId, setActiveId] = useState(stages[0].id);
  const activeStage = stages.find((stage) => stage.id === activeId) ?? stages[0];

  return (
    <section
      className="proof-visualizer page-width"
      id="how-it-works"
      aria-labelledby="proof-path-title"
    >
      <div className="visualizer-heading">
        <div>
          <p className="eyebrow">The proof path</p>
          <h2 id="proof-path-title">One credential. Four places to be precise.</h2>
          <p className="visualizer-intro">
            Follow the same claim from preparation to independent verification, with each storage
            boundary doing one job.
          </p>
        </div>
        <div className="visualizer-disclaimer" role="note">
          <span className="signal-dot" />
          <div>
            <strong>Illustrative credential flow</strong>
            <span>Static fixture · not a live chain read</span>
          </div>
        </div>
      </div>

      <div className="proof-visualizer-grid">
        <ol className="proof-path" aria-label="Four stages of an illustrative credential proof">
          {stages.map((stage, index) => {
            const active = stage.id === activeStage.id;
            return (
              <li className={`proof-stage${active ? ' proof-stage-active' : ''}`} key={stage.id}>
                <button
                  type="button"
                  className="proof-stage-button"
                  aria-pressed={active}
                  onClick={() => setActiveId(stage.id)}
                >
                  <span className="proof-stage-number">{stage.number}</span>
                  <span className="proof-stage-copy">
                    <span className="proof-stage-eyebrow">{stage.eyebrow}</span>
                    <strong>{stage.title}</strong>
                    <span>{stage.summary}</span>
                  </span>
                </button>
                {index < stages.length - 1 ? (
                  <span className="proof-stage-connector" aria-hidden="true" />
                ) : null}
              </li>
            );
          })}
        </ol>

        <article className="proof-detail" aria-live="polite">
          <div className="proof-detail-topline">
            <span>Stage {activeStage.number}</span>
            <span>Illustrative only</span>
          </div>
          <h3>{activeStage.title}</h3>
          <p>{activeStage.detail}</p>
          <dl className="proof-detail-rows">
            {activeStage.rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd className={row.code ? 'proof-detail-code' : undefined}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="proof-detail-footer">
            <span>
              <CheckIcon /> {activeStage.source}
            </span>
            <span>v1 protocol shape</span>
          </div>
        </article>
      </div>

      <div className="visualizer-footer">
        <p>
          This walkthrough explains the storage model. To check a real credential, use the verifier
          with a configured registry and metadata source.
        </p>
        <a className="text-link" href="/verify">
          Open live verifier <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
