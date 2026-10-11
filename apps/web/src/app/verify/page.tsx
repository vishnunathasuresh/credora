import { VerifyForm } from '../../components/verify-form';

export default function VerifyPage() {
  return (
    <main className="page-width narrow-page">
      <h1>Check the record.</h1>
      <p className="lede">
        Scan a credential QR or upload its image. No wallet, account, or issuer relationship is
        needed.
      </p>
      <VerifyForm />
      <div className="verification-note">
        <strong>What happens next</strong>
        <span>
          The QR opens a public verification record. Its proof is checked against the configured
          registry first; metadata availability is reported separately from credential validity.
        </span>
      </div>
    </main>
  );
}
