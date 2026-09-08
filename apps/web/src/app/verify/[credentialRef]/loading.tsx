export default function VerificationLoading() {
  return (
    <main className="page-width narrow-page" aria-busy="true" aria-live="polite">
      <h1>Checking the record.</h1>
      <p className="lede">Reading the immutable registry and its metadata source.</p>
      <div className="loading-panel" aria-hidden="true">
        <span className="loading-line loading-line-short" />
        <span className="loading-line" />
        <span className="loading-line loading-line-medium" />
      </div>
      <p className="form-help">This can take a moment on a cold local node.</p>
    </main>
  );
}
