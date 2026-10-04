'use client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { parseCredentialReference } from '@credora/shared';

export function VerifyForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const parsedReference = parseCredentialReference(reference);
  const valid = Boolean(parsedReference);
  const error =
    hasSubmitted && !valid
      ? 'Paste a public verification link, or a 0x hash with 64 hexadecimal characters.'
      : null;

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
        startTransition(() => router.push(`/verify/${encodeURIComponent(parsedReference!)}`));
      }}
    >
      <Label htmlFor="credential-reference">Credential link or hash</Label>
      <div className="form-row">
        <Input
          id="credential-reference"
          ref={inputRef}
          value={reference}
          onChange={(event) => {
            setReference(event.target.value);
          }}
          placeholder="Paste a verification link or 0x hash"
          spellCheck={false}
          inputMode="text"
          autoCapitalize="off"
          autoComplete="off"
          maxLength={2048}
          required
          aria-invalid={Boolean(error)}
          aria-describedby="credential-reference-help"
        />
        <Button className="button button-dark" type="submit" disabled={isPending}>
          {isPending ? 'Checking…' : 'Verify credential'}
        </Button>
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
