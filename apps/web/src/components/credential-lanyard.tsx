'use client';

import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import type { CSSProperties } from 'react';
import './credential-lanyard.css';

const ReactBitsLanyard = lazy(() => import('./Lanyard'));

class LanyardErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type LanyardPreviewProps = {
  title: string;
  issuerName: string;
  issuerLogoUrl?: string | null;
  issueDate: string;
  recipientName?: string;
  recipientHandle?: string;
  description?: string;
  level?: string;
  credentialHash?: string;
  qrUrl?: string;
  illustrative?: boolean;
  className?: string;
  style?: CSSProperties;
};

function svgText(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return entities[character] ?? character;
  });
}

function svgLines(value: string, limit: number) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > limit && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.map(svgText);
}

function cardSvg(props: LanyardPreviewProps, back = false) {
  const issuer = svgText(props.issuerName.slice(0, 38));
  const titleLines = svgLines(props.title, 24);
  const title = titleLines
    .map((line, index) => `<tspan x="72" dy="${index === 0 ? 0 : 72}">${line}</tspan>`)
    .join('');
  const recipient = svgText(props.recipientName ?? 'Credential holder');
  const issueDate = svgText(
    new Date(props.issueDate).toLocaleDateString(undefined, { dateStyle: 'medium' }),
  );
  const logoUrl =
    props.issuerLogoUrl && /^(https?:\/\/|\/)/.test(props.issuerLogoUrl)
      ? svgText(props.issuerLogoUrl)
      : '';
  const issuerMark = logoUrl
    ? `<image href="${logoUrl}" x="71" y="88" width="68" height="68" preserveAspectRatio="xMidYMid slice" clip-path="url(#issuer-circle)"/>`
    : `<text x="105" y="132" text-anchor="middle" class="monogram">${svgText(props.issuerName.slice(0, 1).toUpperCase())}</text>`;
  const detail = svgText(
    (props.description ?? props.level ?? 'Independently verifiable achievement').slice(0, 65),
  );
  const proof = props.illustrative ? 'ILLUSTRATIVE PREVIEW' : 'VERIFIED PROOF';
  const body = back
    ? `<text x="72" y="270" class="title">${title}</text><text x="72" y="590" class="body">${detail}</text><text x="72" y="800" class="issuer">${issuer}</text><text x="72" y="930" class="body">${issueDate}</text><text x="72" y="1190" class="proof">${svgText((props.credentialHash ?? 'PROOF REFERENCE').slice(0, 32))}</text>`
    : `<circle cx="105" cy="122" r="34" fill="#6d58c9"/><defs><clipPath id="issuer-circle"><circle cx="105" cy="122" r="34"/></clipPath></defs>${issuerMark}<text x="158" y="135" class="issuer">${issuer}</text><text x="72" y="320" class="title">${title}</text><text x="72" y="670" class="recipient">${recipient}</text><text x="72" y="720" class="body">${svgText(props.recipientHandle ? `@${props.recipientHandle}` : '')}</text><text x="72" y="935" class="body">${issueDate}</text><text x="72" y="1220" class="proof">${proof}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1440" viewBox="0 0 1024 1440"><rect width="1024" height="1440" rx="72" fill="#fff"/><rect x="22" y="22" width="980" height="1396" rx="56" fill="none" stroke="#ddd9ec" stroke-width="3"/><path d="M415 24h194l-16 64H431z" fill="#e9e6f2"/><rect x="463" y="21" width="98" height="22" rx="11" fill="#f5f4f8"/>${body}<path d="M72 1310h880" stroke="#e7e4ee" stroke-width="3"/><text x="72" y="1360" class="footer">CREDORA · ${proof}</text><style>.title{font:700 62px Arial,sans-serif;fill:#17151e}.issuer,.recipient{font:600 36px Arial,sans-serif;fill:#282532}.eyebrow{font:600 20px Arial,sans-serif;letter-spacing:3px;fill:#797584}.body{font:400 28px Arial,sans-serif;fill:#55515f}.proof{font:700 21px Arial,sans-serif;letter-spacing:2px;fill:#5944b4}.monogram{font:700 38px Arial,sans-serif;fill:white}.footer{font:600 18px Arial,sans-serif;letter-spacing:2px;fill:#918d9b}</style></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function StaticCredential({ props, back = false }: { props: LanyardPreviewProps; back?: boolean }) {
  const {
    title,
    issuerName,
    recipientName,
    recipientHandle,
    issueDate,
    description,
    level,
    credentialHash,
    illustrative,
  } = props;
  return (
    <article
      className={`credential-lanyard-static${back ? ' is-back' : ''}`}
      aria-label={`${title} credential ${back ? 'details' : 'front'}`}
    >
      {!back ? (
        <>
          <div className="credential-lanyard-issuer">
            <span aria-hidden="true">{issuerName.slice(0, 1).toUpperCase()}</span>
            <strong>{issuerName}</strong>
          </div>
          <h2>{title}</h2>
          <dl>
            <div>
              <dt>Awarded to</dt>
              <dd>
                {recipientName || 'Credential holder'}{' '}
                {recipientHandle ? <span>@{recipientHandle}</span> : null}
              </dd>
            </div>
            <div>
              <dt>Issued</dt>
              <dd>{new Date(issueDate).toLocaleDateString()}</dd>
            </div>
          </dl>
          <p
            className={
              illustrative ? 'credential-lanyard-proof illustrative' : 'credential-lanyard-proof'
            }
          >
            {illustrative ? 'Illustrative preview' : 'Verified proof'}
          </p>
        </>
      ) : (
        <>
          <h2>{title}</h2>
          <p>{description || level || 'Credential evidence and issuer details.'}</p>
          <dl>
            <div>
              <dt>Issuer</dt>
              <dd>{issuerName}</dd>
            </div>
            <div>
              <dt>Recipient</dt>
              <dd>
                {recipientName || 'Credential holder'}
                {recipientHandle ? ` (@${recipientHandle})` : ''}
              </dd>
            </div>
            <div>
              <dt>Issued</dt>
              <dd>{new Date(issueDate).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt>Proof status</dt>
              <dd>{illustrative ? 'Illustrative preview' : 'Verified proof'}</dd>
            </div>
          </dl>
          {credentialHash ? (
            <details>
              <summary>Full proof reference</summary>
              <code>{credentialHash}</code>
            </details>
          ) : null}
        </>
      )}
    </article>
  );
}

export function LanyardPreview(props: LanyardPreviewProps) {
  const [active, setActive] = useState(false);
  const [flipKey, setFlipKey] = useState(0);
  const [showingBack, setShowingBack] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const label = `${props.title}, issued by ${props.issuerName}`;

  return (
    <section
      className={`credential-lanyard ${props.className ?? ''}`.trim()}
      style={props.style}
      aria-label={label}
    >
      {active && !prefersReducedMotion && !webglUnavailable ? (
        <LanyardErrorBoundary onError={() => setWebglUnavailable(true)}>
          <Suspense fallback={<StaticCredential props={props} />}>
            <div className="credential-lanyard-stage" aria-hidden="true">
              <ReactBitsLanyard
                frontImage={cardSvg(props)}
                backImage={cardSvg(props, true)}
                cardColor="#ffffff"
                strapColor="#5340a3"
                metal="silver"
                size={0.72}
                strapLength={0.44}
                strapWidth={0.58}
                gravity={0.8}
                damping={0.62}
                elasticity={0.35}
                breeze={0}
                intro
                interactive
                flipKey={flipKey}
                onUnavailable={() => setWebglUnavailable(true)}
              />
            </div>
          </Suspense>
        </LanyardErrorBoundary>
      ) : (
        <StaticCredential props={props} back={showingBack} />
      )}
      <div className="credential-lanyard-controls">
        <button
          type="button"
          aria-pressed={showingBack}
          onClick={() => {
            if (active && !prefersReducedMotion && !webglUnavailable) {
              setFlipKey((value) => value + 1);
              setShowingBack((value) => !value);
            } else if (prefersReducedMotion || webglUnavailable) {
              setShowingBack((value) => !value);
            } else setActive(true);
          }}
        >
          {active && !prefersReducedMotion && !webglUnavailable
            ? showingBack
              ? 'Show credential front'
              : 'Show credential details'
            : prefersReducedMotion || webglUnavailable
              ? showingBack
                ? 'Show credential front'
                : 'Show credential details'
              : 'Interact with credential'}
        </button>
        {webglUnavailable ? (
          <span>Interactive view unavailable; showing the static credential.</span>
        ) : null}
      </div>
      <details className="credential-lanyard-accessible-details">
        <summary>Credential information</summary>
        <StaticCredential props={props} back />
        {props.qrUrl ? <a href={props.qrUrl}>Open verification record</a> : null}
      </details>
    </section>
  );
}

export function CredentialLanyard({
  front,
  back,
  label,
}: {
  front: ReactNode;
  back: ReactNode;
  label: string;
}) {
  return (
    <div aria-label={label}>
      {front}
      {back}
    </div>
  );
}
