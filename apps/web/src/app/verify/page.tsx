import { VerifyForm } from '../../components/verify-form';

export default function VerifyPage() {
  return (
    <main className="page-width narrow-page">
      <p className="eyebrow">Public verification</p>
      <h1>Check the record.</h1>
      <p className="lede">
        A credential can be verified without a wallet, account, or relationship with the issuer.
      </p>
      <VerifyForm />
      <div className="verification-note">
        <strong>What happens next</strong>
        <span>
          The reference is checked against the configured registry first. Metadata availability is
          reported separately from credential validity.
        </span>
      </div>
    </main>
  );
}
