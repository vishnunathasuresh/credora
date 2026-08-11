'use client';

import { useState } from 'react';

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function VerifyForm() {
  const [reference, setReference] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const valid = HASH_PATTERN.test(reference.trim());

  return (
    <form
      className="verify-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <label htmlFor="credential-reference">Credential hash</label>
      <div className="form-row">
        <input
          id="credential-reference"
          value={reference}
          onChange={(event) => {
            setReference(event.target.value);
            setSubmitted(false);
          }}
          placeholder="0x… 64 hexadecimal characters"
          spellCheck={false}
          inputMode="text"
        />
        <button className="button button-dark" type="submit" disabled={!valid}>
          Verify
        </button>
      </div>
      <div className="form-help" aria-live="polite">
        {submitted && valid
          ? 'Reference accepted. The live registry lookup is ready for the configured network.'
          : 'No wallet required. Verification reads the public credential record.'}
      </div>
    </form>
  );
}
