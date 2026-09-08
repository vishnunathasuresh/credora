'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function VerifyForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const valid = HASH_PATTERN.test(reference.trim());
  const error =
    hasSubmitted && !valid ? 'Enter a 0x-prefixed, 64-character hexadecimal hash.' : null;

  return (
    <form
      className="verify-form"
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        setHasSubmitted(true);
        if (!valid) {
          inputRef.current?.focus();
          return;
        }
        startTransition(() => router.push(`/verify/${encodeURIComponent(reference.trim())}`));
      }}
    >
      <label htmlFor="credential-reference">Credential hash</label>
      <div className="form-row">
        <input
          id="credential-reference"
          ref={inputRef}
          value={reference}
          onChange={(event) => {
            setReference(event.target.value);
          }}
          placeholder="0x… 64 hexadecimal characters"
          spellCheck={false}
          inputMode="text"
          autoCapitalize="off"
          autoComplete="off"
          maxLength={66}
          required
          aria-invalid={Boolean(error)}
          aria-describedby="credential-reference-help"
        />
        <button className="button button-dark" type="submit" disabled={isPending}>
          {isPending ? 'Checking…' : 'Verify credential'}
        </button>
      </div>
      <div
        id="credential-reference-help"
        className={`form-help${error ? ' form-error' : ''}`}
        aria-live="polite"
        role={error ? 'alert' : undefined}
      >
        {error ?? 'No wallet required. Verification reads the public credential record.'}
      </div>
    </form>
  );
}
