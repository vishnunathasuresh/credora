import type { HTMLAttributes } from 'react';

type EditorialProfileIdentityProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  handle: string;
  role: string;
  initials: string;
};

/**
 * Adapted from OpenSource UI's Editorial Staff Profile component.
 * Copyright (c) 2026 Bidyut Kundu. See THIRD_PARTY_NOTICES.md.
 *
 * Keeps the source's compact editorial identity row and square portrait
 * treatment while using Credora's illustrative initials and profile fields.
 */
export function EditorialProfileIdentity({
  name,
  handle,
  role,
  initials,
  className,
  ...props
}: EditorialProfileIdentityProps) {
  return (
    <div className={['editorial-profile-identity', className].filter(Boolean).join(' ')} {...props}>
      <div className="editorial-profile-portrait" aria-hidden="true">
        {initials}
      </div>
      <div className="editorial-profile-copy">
        <h2 className="preview-name">{name}</h2>
        <p className="preview-handle">@{handle}</p>
        <p className="preview-role">{role}</p>
      </div>
    </div>
  );
}
