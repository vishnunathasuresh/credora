'use client';

import { useId, type ReactNode } from 'react';

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="tooltip-wrap">
      <button className="tooltip-trigger" type="button" aria-label={label} aria-describedby={id}>
        i
      </button>
      <span className="tooltip-content" id={id} role="tooltip">
        {children}
      </span>
    </span>
  );
}
