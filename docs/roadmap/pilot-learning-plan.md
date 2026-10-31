# Pilot learning and readiness plan

Status: proposed supervised pilot; no pilot has been recruited or performed.
This plan does not authorize service setup or contact participants.

## What the pilot should learn

The agreed initial audience is students and early-career professionals working
with colleges, clubs, training programs, and projects. That remains a market
hypothesis, not validated demand. Test whether an issuer can issue a credential
with confidence and whether recipients return to use or share it. Do not treat
task completion in a supervised session as evidence of ongoing demand.

| Hypothesis | Evidence to collect |
| --- | --- |
| Organizers can complete a confirmed issuance and understand who controls the issuer authority. | Issuance completion and repeat-use rate below; observe setup, address entry, review, signing, recovery, and questions about organization identity versus wallet proof. |
| Recipients can open and share credentials without an account or wallet, and see why the proof is trustworthy. | First-use completion and repeat-use rate below; observe link/QR opening, verification, sharing, and confusion about proof, issuer identity, or wallet ownership. |
| A recipient who has received one credential has reason to return. | Later-session return within the stated window, plus an optional interview about what prompted or prevented return. This is the core demand hypothesis, not an assumed outcome. |

## Proposed measures

Use a fixed 30-day observation window after each participant's first eligible
event. Include only consenting participants with a complete window in each
denominator; report counts as `n/N` alongside the rate. Do not infer missing
activity as failure. This small supervised pilot is for learning, not a
representative estimate.

| Measure | Numerator / denominator | Window and qualitative learning |
| --- | --- | --- |
| Organizer repeat issuance | Consenting organizer organizations with at least one later, distinct confirmed issuance / consenting organizations with a first confirmed issuance and a full observation window. | 30 days from first confirmed issuance. Note where setup, recipient data, review, transaction status, or recovery made repeat issuance easier or harder. |
| Recipient repeat use | Consenting recipients who return in a separate session to open, verify, or share a credential / consenting recipients who opened a credential and have a full observation window. Count each recipient once. | 30 days from first open. Ask what they returned to do, whether they shared with a verifier, and what blocked return. A required research follow-up is not product use. |
| First-use completion (diagnostic) | Consenting organizers with confirmed issuance / consenting organizers who begin an issuance task; and consenting recipients who reach a verification result / consenting recipients who begin opening a provided link or QR. | Per observed first-use session. Record task outcome and non-identifying friction themes; do not combine the two roles into one rate. |

Before starting, set and document a small pilot cohort and stopping rule with
the study owner. Do not choose a success threshold after seeing results. Report
small denominators plainly and use findings to decide whether to fix readiness
gaps, revise the journey, or run another supervised round.

## Minimal, consent-based learning

- Explain the purpose, activities, voluntary nature, what is recorded, the
  retention period, and how to withdraw before each session. Obtain affirmative
  consent; allow a participant to skip a question or stop without consequence.
- Collect only role, task outcome, broad elapsed-time band, and short
  non-identifying friction notes needed for the measures above. Prefer manual
  tallies and facilitator notes. Do not record names, email, wallet addresses,
  credential references, screenshots, transaction hashes, or session audio.
- Assign a random study code to each consenting participant so separate sessions
  can be counted once. Obtain later-use reports voluntarily from participants;
  signed-out opens and shares cannot be attributed from existing product data.
  Mark unavailable follow-up as missing, not as no return.
- Keep consent records separate from learning notes, restrict access to the
  named study owner, and delete raw notes and consent linkage 30 days after the
  last session. Retain only de-identified aggregate counts and themes. Honor
  withdrawal by deleting the participant's linked notes before aggregation.
- No analytics or tracking is implemented by this plan. Do not add product
  events, tracking scripts, service configuration, or pilot contacts here.

## Readiness gates before any pilot

Treat each item as a blocking gate; record evidence and owner before inviting
anyone. The implementation status below reflects repository documents/source,
not live deployment or pilot evidence.

1. **Issuance and deployment:** prove a fresh, authorized organization can
   complete draft → metadata → registry transaction → confirmed record on the
   intended deployment, and distinguish pending, rejected, reverted, and
   unavailable states. Contract security review, contract tests, and fresh
   registry browser acceptance are still listed as pending in the
   [sprint plan](sprints.md).
2. **Exact recipient address:** before signing, show the full normalized
   recipient address in a review step and require the issuer to affirm it.
   Confirm it against the recipient's supplied address through a supervised
   process; never treat a handle lookup or display name as the binding. Exercise
   this for single and batch issuance, including correction before signing.
3. **No-login verification:** demonstrate a real issued link and QR in a clean,
   signed-out browser, with no wallet connection, for valid, absent, malformed,
   mismatch, metadata-unavailable, and ledger-unavailable states. Public routes
   and direct-RPC fallback exist in source; production behavior still needs
   deployed acceptance evidence.
4. **Recovery and backup:** document and exercise recovery from interrupted
   issuance and loss of the issuer browser session; separately restore profile,
   account, wallet-association, and organization application data from backup.
   Account recovery restores application access only; it does not recover a
   wallet key or transfer credential ownership ([ADR 0012](../decisions/0012-google-account-authentication.md),
   [ADR 0013](../decisions/0013-account-wallet-association.md)). Confirm the
   operator's organization-key custody and incident path before issuance.
5. **Issuer identity versus proof:** verify organization review and activation
   evidence, then show participants separately what the registry proves (the
   issuing wallet and credential binding) and what Credora's off-chain review
   says about the organization. Neither a valid proof nor a reviewed profile
   alone establishes the recipient's real-world identity or current wallet
   control ([ADR 0010](../decisions/0010-organization-controlled-issuer-authority.md)).
6. **v3 independent verifier gap:** API verification supports organization
   credentials, but the current direct-RPC fallback reads the v1 registry and
   v1 ABI. Implement and independently exercise direct v3 verification,
   including organization binding and current versus issuance-time authority,
   before claiming v3 credentials remain independently verifiable during API
   outage. Keep v1/v2 routing unchanged; do not silently route old proofs
   through v3. See [ADR 0010](../decisions/0010-organization-controlled-issuer-authority.md)
   and [verification source](../../apps/web/src/lib/direct-verification.server.ts).

## Decision after the pilot

Review the measures with the participating organizers and recipients. Preserve
the difference between observed evidence, participant explanations, and
hypotheses. Decide whether repeat issuance and recipient return justify another
round or broader investment; do not use a small supervised cohort to claim
market validation. Keep any product analytics proposal separate and obtain
privacy review and explicit consent design before implementation.
