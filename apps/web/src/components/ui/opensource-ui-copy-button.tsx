'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon } from '../icons';
import { Button } from './button';

type OpenSourceUICopyButtonProps = {
  onCopy: () => Promise<boolean>;
  label?: string;
  copiedLabel?: string;
  resetMs?: number;
  disabled?: boolean;
};

/**
 * Adapted from OpenSource UI's CopyButton component.
 * Copyright (c) 2026 Bidyut Kundu. See THIRD_PARTY_NOTICES.md.
 *
 * The owning share flow supplies its existing copy and fallback behavior so
 * errors remain visible in the right place.
 */
export function OpenSourceUICopyButton({
  onCopy,
  label = 'Copy link',
  copiedLabel = 'Copied',
  resetMs = 1600,
  disabled = false,
}: OpenSourceUICopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) globalThis.clearTimeout(timerRef.current);
    },
    [],
  );

  async function handleCopy() {
    setPending(true);
    let succeeded = false;
    try {
      succeeded = await onCopy();
    } catch {
      succeeded = false;
    } finally {
      setPending(false);
    }
    if (!succeeded) return;

    setCopied(true);
    if (timerRef.current !== null) globalThis.clearTimeout(timerRef.current);
    timerRef.current = globalThis.setTimeout(() => setCopied(false), resetMs);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-copy-state={copied ? 'copied' : undefined}
        aria-busy={pending}
        disabled={disabled || pending}
        onClick={() => void handleCopy()}
      >
        {copied ? (
          <CheckIcon size={16} />
        ) : (
          <svg
            className="icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5V3.75A1.75 1.75 0 0 0 8.75 2h-5A1.75 1.75 0 0 0 2 3.75v5.5A1.75 1.75 0 0 0 3.75 11H5.5" />
          </svg>
        )}
        {pending ? 'Copying…' : copied ? copiedLabel : label}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? copiedLabel : ''}
      </span>
    </>
  );
}
